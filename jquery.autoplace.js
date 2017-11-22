(function($) {

	'use strict';

	var autoplaceLinker = [];

	$.fn.autoplace = function(options) {

		options = options || {};

		if (typeof options === 'object') {

			this.each(function() {

				new AutoPlace(this, options);

			});

			return this;

		} else {

			throw new Error('Invalid arguments for AutoPlace: ' + options);

		}

	};

	var AutoPlace = function (element, options) {

		// https://developers.google.com/maps/documentation/javascript/3.exp/reference#AutocompleteOptions
		options = options || {};

		element.id = generateId(element);

		element.classList.add('autoplace');

		autoplaceLinker.push({'id': element.id, linked: false});

		var autocomplete = new google.maps.places.Autocomplete(element, options);

		element.addEventListener('input', correctInput);

		element.addEventListener('keypress', function(event) {

			if (event.keyCode === 13) {

				var dropdownMenu = document.querySelector('[aria-labelledby="' + element.id + '"]');

				var active = dropdownMenu.querySelector('.active') !== null;

				if (!active) {

					dropdownMenu.children[0].dispatchEvent(new Event('mousedown'));

					element.blur();
					element.focus();

					var last = element.value.substr(element.value.length - 1);

					element.value = element.value.substr(0, element.value.length - 1);
					element.value = element.value + last;

				}

			}

		});

		google.maps.event.addListener(autocomplete, 'place_changed', function(gg) {

			var details = autocomplete.getPlace();

			if (details.address_components) {

				element.dispatchEvent(new CustomEvent('autoplace-details', {detail: details}));

			}

		});

	}

	var generateId = function(element) {

		var id;

		if (element.id) {

			id = element.id;

		} else {

			id = 'autoplace-' + Math.random().toString(36).substr(2, 5);

		}

		return id;

	}

	var correctInput = function() {

		var element = this;

		var inputType = element.oldValue && element.oldValue.length > element.value.length ? 'delete' : 'insert';

		element.oldValue = element.value;

		if (inputType === 'insert') {

			var prediction = element.getAttribute('data-autoplace-prediction');

			var input = element.value.substr(element.value.length - 1, 1);

			var match = prediction && prediction.toLowerCase() === input.toLowerCase();

			if (match && (isNaN(input) && input.isLower() && prediction.isUpper())) {

				var correctedInput = element.value.substr(0, element.value.length - 1) + prediction;

				element.value = correctedInput;

				element.setAttribute('data-autoplace-corrected-input', correctedInput);

			} else if (!match || (isNaN(input) && input.isUpper() && prediction.isLower())) {

				element.setAttribute('data-autoplace-corrected-input', '');
				element.setAttribute('data-autoplace-suggestion', '');
				element.setAttribute('data-autoplace-corrected-suggestion', '');

				element.dispatchEvent(new Event('autoplace-suggestion'));

			}

		} else if (element.value === '') {

			element.setAttribute('data-autoplace-corrected-input', '');
			element.setAttribute('data-autoplace-suggestion', '');
			element.setAttribute('data-autoplace-corrected-suggestion', '');

			element.dispatchEvent(new Event('autoplace-suggestion'));

		} else {

			element.setAttribute('data-autoplace-corrected-input', '');

		}

	}

	var correctChange = function(event) {

		var dropdownItem = this;

		if (!dropdownItem.classList.contains('disabled')) {

			var id = dropdownItem.parentNode.getAttribute('aria-labelledby');

			var element = document.getElementById(id);

			element.value = dropdownItem.textContent;

			element.setAttribute('data-autoplace-corrected-input', '');
			element.setAttribute('data-autoplace-suggestion', '');
			element.setAttribute('data-autoplace-corrected-suggestion', '');

			element.dispatchEvent(new Event('autoplace-suggestion'));

		}

	}

	var stylesheetObserver = function() {

		var observer = new MutationObserver(function(mutations) {

			mutations.forEach(function(mutation) {

				if (
					mutation.addedNodes.length &&
					mutation.addedNodes[0].sheet &&
					mutation.addedNodes[0].sheet.cssRules.length &&
					mutation.addedNodes[0].sheet.cssRules[0].selectorText === '.pac-container'
				) {

					observer.disconnect();

					replaceStylesheet(mutation.addedNodes[0]);

				}

			});

		});

		observer.observe(document.head, {childList: true});

	}

	var replaceStylesheet = function(stylesheet) {

		stylesheet.remove();

		if (!document.getElementById('autoplace-styles')) {

			var css = '';

			css += '.autoplace-dropdown { display: block; width: auto !important; }';
			css += '.autoplace-dropdown .dropdown-item { cursor: pointer; };';

			var style = document.createElement('style');

			style.id = 'autoplace-styles';

			style.type = 'text/css';

			style.appendChild(document.createTextNode(css));

			document.head.appendChild(style);

		}

	}

	var dropdownMenuObserver = function() {

		var observer = new MutationObserver(function(mutations) {

			mutations.forEach(function(mutation) {

				if (
					mutation.addedNodes.length &&
					mutation.addedNodes[0].className === 'pac-container pac-logo'
				) {

					observer.disconnect();

					replaceDropdownMenu(mutation.addedNodes[0]);

				}

			});

		});

		observer.observe(document.body, {childList: true});

	}

	var replaceDropdownMenu = function(dropdownMenu) {

		var id;

		for (var i = 0; i < autoplaceLinker.length; i++) {

			if (!autoplaceLinker[i].linked) {

				id = autoplaceLinker[i].id;

				autoplaceLinker[i].linked = true;

				break;

			}

		}

		dropdownMenu.classList.remove('pac-logo');
		dropdownMenu.classList.remove('pac-container');

		dropdownMenu.classList.add('dropdown-menu');
		dropdownMenu.classList.add('autoplace-dropdown');

		dropdownMenu.setAttribute('aria-labelledby', id);

		dropdownItemInsertObserver(dropdownMenu);

	}

	var dropdownItemInsertObserver = function(dropdownMenu) {

		var observer = new MutationObserver(function(mutations) {

			mutations.forEach(function(mutation) {

				if (mutation.addedNodes.length && mutation.addedNodes[0].classList.contains('pac-item')) {

					replaceDropdownItem(mutation.addedNodes[0]);

				}

			});

			var id = dropdownMenu.getAttribute('aria-labelledby');

			document.getElementById(id).dispatchEvent(new Event('autoplace-menu'));

			var suggestion = '';

			if (dropdownMenu.children.length) {

				suggestion = dropdownMenu.children[0].textContent;

			}

			updateSuggestion(id, suggestion);

		});

		observer.observe(dropdownMenu, {childList: true});

	}

	var dropdownItemActiveObserver = function(dropdownItem) {

		var observer = new MutationObserver(function(mutations) {

			mutations.forEach(function(mutation) {

				var dropdownMenu = mutation.target.parentNode;

				if (mutation.target.classList.contains('pac-item-selected')) {

					for (var i = dropdownMenu.children.length - 1; i >= 0; i--) {

						if (dropdownMenu.children[i].classList.contains('active')) {

							dropdownMenu.children[i].classList.remove('active');

						}

					}

					mutation.target.classList.remove('pac-item-selected');
					mutation.target.classList.add('active');

					var id = dropdownMenu.getAttribute('aria-labelledby');

					var suggestion = mutation.target.textContent;

					updateSuggestion(id, suggestion);

				}

			});

		});

		observer.observe(dropdownItem, {attributes: true, attributeFilter: ['class']});

	}

	var replaceDropdownItem = function(dropdownItem) {

		dropdownItem.classList.remove('pac-item');
		dropdownItem.classList.add('dropdown-item');

		dropdownItemActiveObserver(dropdownItem);

		dropdownItem.addEventListener('mousedown', correctChange);

		for (var i = dropdownItem.children.length - 1; i >= 0; i--) {

			var span = dropdownItem.children[i];

			if (span.className === 'pac-icon pac-icon-marker') {

				span.remove();

				continue;

			}

			if (span.className === 'pac-item-query') {

				span.classList.remove('pac-item-query');

				span.removeAttribute('class');

				span.innerHTML += ' ';

			}

			for (var j = span.children.length - 1; j >= 0; j--) {

				if (span.children[j].className === 'pac-matched') {

					span.children[j].convertElement('strong');

				}

			}

		}

	}

	var updateSuggestion = function(id, suggestion) {

		var input = document.getElementById(id).value;

		var match = suggestion.toLowerCase().startsWith(input.toLowerCase());

		var correctedSuggestion = '';

		var prediction = '';

		if (match && input !== suggestion) {

			if (input.length === 1) {

				correctedSuggestion = input + suggestion.substr(1);

			} else if (input.length > 1) {

				correctedSuggestion = input + suggestion.substr(input.length);

			}

			prediction = correctedSuggestion.substr(input.length, 1);

		}

		document.getElementById(id).setAttribute('data-autoplace-suggestion', suggestion);
		document.getElementById(id).setAttribute('data-autoplace-corrected-suggestion', correctedSuggestion);
		document.getElementById(id).setAttribute('data-autoplace-prediction', prediction);

		document.getElementById(id).dispatchEvent(new Event('autoplace-suggestion'));

	}

	String.prototype.isLower = function() {

		var character = this.charAt(0);

		if (character === character.toLowerCase()) {

			return true;

		} else {

			return false;

		}

	}

	String.prototype.isUpper = function() {

		var character = this.charAt(0);

		if (character === character.toUpperCase()) {

			return true;

		} else {

			return false;

		}

	}

	Element.prototype.convertElement = function(tag) {

		var replacement = document.createElement(tag);

		replacement.innerHTML = this.innerHTML;

		this.parentNode.replaceChild(replacement, this);

		return replacement;

	};

	stylesheetObserver();
	dropdownMenuObserver();

}(jQuery));
