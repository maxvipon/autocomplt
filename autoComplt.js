(function(root, factory) {
    if(typeof define === 'function' && define.amd) {
        define([], function() {
            return factory(root);
        });
    } else if(typeof exports === 'object') {
        module.exports = factory(root);
    } else {
        root.autocomplt = factory(root);
    }
}(this, function(root) {
    /*jshint maxstatements:30, maxcomplexity:20 */
    'use strict';

    /**
     * Little debug flag
     * @type {number}
     * @private
     */
    var DEBUG = 0;

    /**
     * Constants collection
     * @private
     */
    var DEFS = {

        autocompltListClass: 'autocomplt-list',
        autocompltHintClass: 'autocomplt-hint',
        autocompltHintSelectedClass: 'autocomplt-hint-selected',
        maxHintNum: 10,
        autoWidth: false,
        autocompltDelay: 100, // in ms
        listStatus: {
            attr: 'data-listStatus',
            open: 'open'
        },
        keyCode: {
            up: 38,
            down: 40,
            esc: 27,
            enter: 13
        },
        styles: {
            autocompltList: {
                maxHeight: 'none',
                minWidth: '25em',
                border: 'none',
                padding: '0',
                margin: '0',
                zIndex: '99',
                overflowX: 'hidden',
                overflowY: 'auto',
                display: 'none',
                position: 'absolute',
                backgroundColor: '#fff',
                boxShadow: '0 0 0 1px rgba(0,0,0,.1) inset, 0 10px 20px -5px rgba(0,0,0,.4)'
            },
            autocompltHint: {
                height: '1.5em',
                padding: '2px 20px 2px 10px',
                margin: '0',
                overflow: 'hidden',
                listStyleType: 'none',
                color: '#000',
                backgroundColor: '#fff',
                cursor: 'default',
                fontSize: '1em'
            },
            autocompltHintSelected: {
                backgroundColor: '#fdedaf'
            }
        },
        adjStyleAttrs: {
            autocompltList: ['border', 'maxHeight', 'backgroundColor'],
            autocompltHint: ['height', 'padding', 'margin', 'color', 'backgroundColor', 'fontSize'],
            autocompltHintSelected: ['color', 'backgroundColor']
        }
    };

    /**
     * Normalize the event obj
     * @param   {Event} e Event object
     * @returns {Event}   Normalized event object
     * @private
     */
    function normalizeEvent(e) {
        e = e || window.event;
        e.stopBubble = function() {
            this.cancelBubble = true;
            if(this.stopPropoagation) { this.stopPropoagation(); }
        };
        e.stopDefault = function() {
            if(this.preventDefault) { this.preventDefault(); }
            this.returnValue = false;
            return false;
        };
        return e;
    }

    /**
     * Add an event to one elem, used for cross-browser mitigation
     * @param   {HTMLElement} elem    DOM element
     * @param   {String}      evt     Event name
     * @param   {Function}    eHandle Event Handle
     * @private
     */
    function addEvent(elem, evt, eHandle) {
        if(elem.addEventListener) {
            elem.addEventListener(evt, eHandle);
        } else if(elem.attachEvent) { // The IE 8 case
            elem.attachEvent('on' + evt, eHandle);
        }
    }

    /**
     * Remove an event to one elem, used for cross-browser mitigation
     * @param   {HTMLElement} elem    DOM element
     * @param   {String}      evt     Event name
     * @param   {Function}    eHandle Event Handle
     * @private
     */
    function removeEvent(elem, evt, eHandle) {
        if(elem.removeEventListener) {
            elem.removeEventListener(evt, eHandle);
        } else if(elem.detachEvent) { // The IE 8 case
            elem.detachEvent('on' + evt, eHandle);
        }
    }

    /**
     * Get the computed style value, used for cross-browser mitigation
     * @param   {HTMLElement} elem DOM element
     * @param   {String}      name Style name
     * @returns {Object}
     * @private
     */
    function getComputedStyle(elem, name) {
        var v = null;

        if(window.getComputedStyle) {

            v = window.getComputedStyle(elem)[name] || null;

        } else if(elem.currentStyle) { // Hack for IE...Reference from the jQuery

            v = elem.currentStyle && elem.currentStyle[name];

            var left,
                rsLeft,
                style = elem.style;

            // Avoid setting v to empty string here
            // so we don't default to auto
            if(v === null && style && style[name]) {
                v = style[name];
            }

            // From the awesome hack by Dean Edwards
            // http://erik.eae.net/archives/2007/07/27/18.54.15/#comment-102291

            // If we're not dealing with a regular pixel number
            // but a number that has a weird ending, we need to convert it to pixels
            // but not position css attributes, as those are proportional to the parent element instead
            // and we can't measure the parent instead because it might trigger a "stacking dolls" problem

            // Remember the original values
            left = style.left;
            rsLeft = elem.runtimeStyle && elem.runtimeStyle.left;

            // Put in the new values to get a computed value out
            if( rsLeft ) {
                elem.runtimeStyle.left = elem.currentStyle.left;
            }
            style.left = name === 'fontSize' ? '1em' : v;
            v = style.pixelLeft + 'px';

            // Revert the changed values
            style.left = left;
            if( rsLeft ) {
                elem.runtimeStyle.left = rsLeft;
            }

        }

        return v;
    }

    /**
     * Object to build UI
     * @private
     */
    var UI = {
        /**
         * Build on elem from the HTML text
         * @param   {String}      html HTMl text
         * @returns {HTMLElement}      Element built from the input HTML
         */
        buildElem: function(html) {
            var div = document.createElement('div');
            div.innerHTML = html;
            return div.firstChild.cloneNode(true);
        },
        /**
         * Build one autocomplete hint elem
         * @param   {String}      hint   Hint text
         * @param   {Object}      style  Object holding the styles to set. Refer to DEFS.defaultStyles.autocompltHint for the required styles
         * @returns {HTMLElement}
         */
        buildHint: function(hint, style) {
            if(typeof hint !== 'string') {
                hint = '';
            }

            var hintStyle = style.autocompltHint;

            hint = this.buildElem('<li class="' + DEFS.autocompltHintClass + '">' + hint + '</li>');

            hint.style.height = hint.style.lineHeight = hintStyle.height; // line-height shall always be equal to the height
            hint.style.padding         = hintStyle.padding;
            hint.style.margin          = hintStyle.margin;
            hint.style.overflow        = hintStyle.overflow;
            hint.style.listStyleType   = hintStyle.listStyleType;
            hint.style.color           = hintStyle.color;
            hint.style.backgroundColor = hintStyle.backgroundColor;
            hint.style.cursor          = hintStyle.cursor;
            hint.style.fontSize        = hintStyle.fontSize;

            return hint;
        },
        /**
         * Build one autocomplete list
         * @param   {Object}      style List ui elem
         * @returns {HTMLElement}
         */
        buildList: function(style) {
            var listStyle = style.autocompltList;

            var list = this.buildElem('<ul class="' + DEFS.autocompltListClass + '"></ul>');

            list.style.maxHeight       = listStyle.maxHeight;
            list.style.minWidth        = listStyle.minWidth;
            list.style.border          = listStyle.border;
            list.style.padding         = listStyle.padding;
            list.style.margin          = listStyle.margin;
            list.style.zIndex          = listStyle.zIndex;
            list.style.overflowX       = listStyle.overflowX;
            list.style.overflowY       = listStyle.overflowY;
            list.style.display         = listStyle.display;
            list.style.position        = listStyle.position;
            list.style.backgroundColor = listStyle.backgroundColor;
            list.style.boxShadow       = listStyle.boxShadow;

            return list;
        }
    };

    /**
     * Autocomplete list constructor
     * @param   {HTMLElement} assocInput Input elem associated with
     * @private
     */
    var AutoCompltList = function(assocInput) {
        // autocomplete list current being displayed and associated with
        this.uiElem = null;
        this.assocInput = assocInput;
        // flag marking the moused is on the top of the hints list
        this.mouseOnList = false;
        // max number of hints displayed
        this.maxHintNum = DEFS.maxHintNum;
        // flag marking hints list has an auto width
        this.autoWidth = DEFS.autoWidth;
        // object holding the style setting of the list and hints.
        // Refer to DEFS.defaultStyles for the required styles.
        this.styles = JSON.parse(JSON.stringify(DEFS.styles)); // Copy the default first

    };
    /**
     * Build and setup one autocomplete list
     */
    AutoCompltList.prototype.genList = function() {
        if(!!this.uiElem) {
            return;
        }

        var that = this;

        this.uiElem = UI.buildList(this.styles);

        // Make hint selected onmouseover
        addEvent(this.uiElem, 'mouseover', function(e) {
            e = normalizeEvent(e);
            if(that.isHint(e.target)) {
                that.select(e.target);
                that.autoScroll();
            }
        });

        // Make hint not selected onmouseout
        addEvent(this.uiElem, 'mouseout', function() {
            that.deselect();
        });

        // Prepare for the hint selection by clicking
        addEvent(this.uiElem, 'mousedown', function() {
            that.mouseOnList = true;
            // One hack for FF.
            // Even call focus methos on the input's onblur event, however, still the input losese its focus.
            // As a result we have to set a timeout here
            setTimeout(function() {
                that.assocInput.focus();
            }, 50);
        });

        // Select hint by clicking
        addEvent(this.uiElem, 'mouseup', function(e) {
            e = normalizeEvent(e);
            if(that.isHint(e.target)) {
                that.select(e.target);
                that.assocInput.value = that.getSelected().innerHTML;
                that.assocInput.autocomplt.close();
            }
        });

        document.body.appendChild(this.uiElem);
    };
    /**
     * Check if it is a autocomplete hint elem or not
     * @param   {HTMLElement} el Element to check
     * @returns {Boolean}
     */
    AutoCompltList.prototype.isHint = function(el) {
        if(typeof el === 'object' && el.nodeType === 1) {
            var cls = ' ' + el.className + ' ';
            return cls.indexOf(' ' + DEFS.autocompltHintClass + ' ') >= 0;
        }
        return false;
    };
    /**
     * Put hints into the autocomplete list
     * @param   {String[]} hints Array of hint texts
     * @returns {number}         Number of hints put
     */
    AutoCompltList.prototype.putHints = function(hints) {
        var count = 0;
        if(hints instanceof Array) {
            var i,
                j,
                hs = [];

            j = Math.min(hints.length, this.maxHintNum);
            for(i = 0; i < j; i++) {
                hs.push(UI.buildHint(hints[i], this.styles));
                if(!hs[hs.length - 1]) {
                    hs.pop();
                }
            }

            if(hs.length > 0) {
                var buf = document.createDocumentFragment();
                for(i = 0, count = hs.length; i < count; i++) {
                    buf.appendChild(hs[i]);
                }
                this.clearHints();

                this.genList(); // Geneate the list in case there is none
                this.uiElem.appendChild(buf);
            }
        }
        return count;
    };
    /**
     * Clear all hints
     */
    AutoCompltList.prototype.clearHints = function() {
        if(this.uiElem) {
            this.uiElem.innerHTML = '';
        }
    };
    /**
     * Tell if the auotcomplete list is open or not
     * @returns {Boolean}
     */
    AutoCompltList.prototype.isOpen = function() {
        return !!this.uiElem && this.uiElem.getAttribute(DEFS.listStatus.attr) === DEFS.listStatus.open;
    };
    /**
     * Open the autocomplete list.
     * NOTICE: before opening, there must at one hint in the list so please call this.putHints first then open.
     */
    AutoCompltList.prototype.open = function() {
        var hints;

        // At lease one hint exists, we would open...
        if(this.uiElem && (hints = this.uiElem.getElementsByClassName(DEFS.autocompltHintClass)) && hints.length) {
            var i,
                buf;

            // Position the list
            buf = this.assocInput.getBoundingClientRect();
            this.uiElem.style.top = (document.documentElement && document.documentElement.scrollTop ? document.documentElement.scrollTop : document.body.scrollTop) + buf.bottom + 'px';
            this.uiElem.style.left = buf.left + 'px';

            // Calculate the list's width
            buf = buf.right - buf.left - parseFloat(getComputedStyle(this.uiElem, 'borderLeftWidth')) - parseFloat(getComputedStyle(this.uiElem, 'borderRightWidth'));

            if(this.autoWidth) {
                this.uiElem.style.maxWidth = buf + 'px';
            } else {
                this.uiElem.style.width    = buf + 'px';
            }

            // Calculate the list's height
            for(i = 0, buf = 0; i < hints.length; i++) {
                buf += parseFloat(getComputedStyle(hints[i], 'height'));
                buf += parseFloat(getComputedStyle(hints[i], 'paddingTop'));
                buf += parseFloat(getComputedStyle(hints[i], 'paddingBottom'));

                if(hints[i + 1]) { // Compute the margin between the hints
                    buf += Math.max(
                        parseFloat(getComputedStyle(hints[i], 'marginBottom')),
                        parseFloat(getComputedStyle(hints[i + 1], 'marginTop'))
                    );
                }
            }
            buf += parseFloat(getComputedStyle(hints[0], 'marginTop'));
            buf += parseFloat(getComputedStyle(hints[hints.length - 1], 'marginBottom'));

            // Plus one for a little buffer
            this.uiElem.style.height = (buf + 1) + 'px';

            // Open
            this.uiElem.setAttribute(DEFS.listStatus.attr, DEFS.listStatus.open);
            this.uiElem.style.display = 'block';
        }
    };
    /**
     * Close the autocomplete list
     */
    AutoCompltList.prototype.close = function() {
        if(!this.uiElem || DEBUG) {
            return;
        }

        this.mouseOnList = false;
        this.uiElem.parentNode.removeChild(this.uiElem);
        this.uiElem = null;
    };
    /**
     * Auto scroll the list according the position and offset of the current selected hint
     * so the current selected hint could show up
     */
    AutoCompltList.prototype.autoScroll = function() {
        var hint = this.getSelected();

        if(!hint) {
            return;
        }

        var currHint,
            offset = 0,
            minDisplayH = 0,
            hintH = hint.clientHeight,
            hintMT = parseFloat(getComputedStyle(hint, 'marginTop')),
            hintMB = parseFloat(getComputedStyle(hint, 'marginBottom'));

        currHint = hint.previousSibling;

        minDisplayH = hintH + (currHint ? Math.max(hintMT, hintMB) : hintMT); // The min height to display one hint

        while(currHint) {

            offset += hintH; // Add the current hint' hintH

            currHint = currHint.previousSibling;
            if(currHint) {
                // There is one hint before the current hint so calculate based on the collapsed model
                offset += Math.max(hintMT, hintMB);
            } else {
                // No more previous hint, this is the 1st hint so just take the marign top
                offset += hintMT;
            }
        }

        if(this.uiElem.clientHeight + this.uiElem.scrollTop - offset < minDisplayH || offset - this.uiElem.scrollTop < minDisplayH) {
            // There is no enough room displaying the current selected hint so adjust the scroll
            this.uiElem.scrollTop = offset;
        }
    };
    /**
     * Select one hint.
     *
     * NOTICE: this action will not change this.assocInput's value.
     * Please use this.getSelected to get the selected hint
     * and extract the hint text and assign this.assocInput's value the hint text
     *
     * @param {HTMLElement|Number} candidate Candidate to select. Could be
     *                                       1) hint element
     *                                       2) index of the hint in the list
     *                                          a. Passing in -1 would select the last hint.
     *                                          b. Passing in 0 would select the 1st hint.
     */
    AutoCompltList.prototype.select = function(candidate) {
        if(!this.uiElem) {
            return;
        }

        var hint = null;

        if(this.isHint(candidate)) {
            hint = candidate;
        } else if(typeof candidate === 'number' && (candidate >= 0 || candidate === -1)) {
            var hints = this.uiElem.getElementsByClassName(DEFS.autocompltHintClass);

            if(hints.length > 0) {
                hint = +candidate;
                hint = (hint === -1 || hint > hints.length - 1) ? hints.length - 1 : hint;
                hint = hints[hint];
            }
        }

        if(hint !== null) {
            this.deselect();
            hint.className += ' ' + DEFS.autocompltHintSelectedClass;
            hint.style.color = this.styles.autocompltHintSelected.color;
            hint.style.backgroundColor = this.styles.autocompltHintSelected.backgroundColor;
        }
    };
    /**
     * Deselect all hints
     */
    AutoCompltList.prototype.deselect = function() {
        if(!this.uiElem) {
            return;
        }

        var slct = this.getSelected();

        if(slct) {
            slct.className = DEFS.autocompltHintClass;
            slct.style.color = this.styles.autocompltHint.color;
            slct.style.backgroundColor = this.styles.autocompltHint.backgroundColor;
        }
    };
    /**
     * Get the hint elem selected
     * @returns {Null|HTMLElement}
     */
    AutoCompltList.prototype.getSelected = function() {
        return !this.uiElem ? null : this.uiElem.getElementsByClassName(DEFS.autocompltHintSelectedClass)[0] || null;
    };

    var autocomplt = {

        enable: function(input, params) {
            if( typeof input !== 'object' ||
                typeof input.tagName !== 'string' ||
                input.tagName.toLowerCase() !== 'input' ||
                input.type !== 'text' ||
                input.nodeType !== 1 ||
                !!input.autocomplt
            ) {
                return null;
            }

            input.autocomplt = {};

            var // the ms delays the work of fetching the autocomplete hints based on the user's input
                inputAutocompltDelay = DEFS.autocompltDelay,
                // true to perform the autocomplete function; false not to perform.
                inputAutocompltEnabled = true,
                // the current user's input for which the autocomplete is target
                inputAutocompltCurrentTarget = '',
                // the instance of _AutoCompltList
                inputAutocompltList = new AutoCompltList(input),
                // the function fetching the autocomplete hints
                inputAutocompltHintsFetcher = null,
                /**
                 * Setup and call input_autocomplt_hintsFetcher to fetch the hints
                 */
                inputAutocompltStartFetcher = function() {
                    if( !this.value.length ||
                        !inputAutocompltEnabled ||
                        typeof inputAutocompltHintsFetcher !== 'function' &&
                        inputAutocompltCurrentTarget === this.value // If equals, it means we've already been searching for the hints for the same value
                    ) {
                        return;
                    }

                    var fetcherCaller = {};

                    fetcherCaller.call = function() {
                        inputAutocompltHintsFetcher.call(
                            fetcherCaller.that,
                            fetcherCaller.compltTarget,
                            fetcherCaller.openHint
                        );
                    };

                    fetcherCaller.that = input;

                    // Record the autocomplete target for this fetching job
                    fetcherCaller.compltTarget = inputAutocompltCurrentTarget = this.value;

                    fetcherCaller.openHint = function(hints) {
                        // If the user's input has changed during the fetching, this fetching job is useless.
                        // So only when the user's input doesn't change, we will proceed further.
                        if(fetcherCaller.compltTarget === inputAutocompltCurrentTarget) {
                            if(inputAutocompltList.putHints(hints)) {
                                inputAutocompltList.open();
                            } else {
                                fetcherCaller.that.autocomplt.close();
                            }
                        }
                    };

                    setTimeout(fetcherCaller.call, inputAutocompltDelay);
                },
                /**
                 * Autocomplete the <input> according to the hint selection state
                 */
                inputAutocompltCompleteInput = function() {
                    if(!inputAutocompltEnabled) {
                        return;
                    }

                    var hint = inputAutocompltList.getSelected();

                    if(hint) {
                        this.value = hint.innerHTML;
                    } else {
                        // If no hint is selected, just use the original user input to autocomplete
                        this.value = inputAutocompltCurrentTarget;
                    }
                },
                /**
                 * Blur event handle
                 */
                inputAutocompltBlurEvtHandle = function() {
                    if(inputAutocompltList.mouseOnList) {
                        // If the mouse is on the autocomplete list, do not close the list
                        // and still need to focus on the input.
                        input.focus();
                        inputAutocompltList.mouseOnList = false; // Assign false for the next detection
                    } else {
                        input.autocomplt.close();
                    }
                },
                /**
                 * Keyboard event handle
                 * @param {Event} e Event object
                 */
                inputAutocompltKeyEvtHandle = function(e) {
                    if(!inputAutocompltEnabled) {
                        return;
                    }

                    e = normalizeEvent(e);

                    if( e.type === 'keydown' &&
                        inputAutocompltList.isOpen() &&
                        (e.keyCode === DEFS.keyCode.up || e.keyCode === DEFS.keyCode.down)
                    ) {
                        // At the case that the hint list is open ans user is walkin thru the hints.
                        // Let's try to autocomplete the input by the selected input.

                        var hint = inputAutocompltList.getSelected();

                        if(e.keyCode === DEFS.keyCode.up) {

                            if(!hint) {
                                // If none is selected, then select the last hint
                                inputAutocompltList.select(-1);
                            } else if(hint.previousSibling) {
                                // If some hint is selected and the previous hint exists, then select the previous hint
                                inputAutocompltList.select(hint.previousSibling);
                            } else {
                                // If some hint is selected but the previous hint doesn't exists, then deselect all
                                inputAutocompltList.deselect();
                            }

                        } else if(e.keyCode === DEFS.keyCode.down) {

                            if(!hint) {
                                // If none is selected, then select the first hint
                                inputAutocompltList.select(0);
                            } else if(hint.nextSibling) {
                                // If some hint is selected and the next hint exists, then select the next hint
                                inputAutocompltList.select(hint.nextSibling);
                            } else {
                                // If some hint is selected but the next hint doesn't exists, then deselect all
                                inputAutocompltList.deselect();
                            }

                        }

                        inputAutocompltList.autoScroll();

                        inputAutocompltCompleteInput.call(input);

                    } else if(e.type === 'keyup') {

                        var startFetching = false;

                        switch(e.keyCode) {
                            case DEFS.keyCode.up:
                            case DEFS.keyCode.down:
                                if(inputAutocompltList.isOpen()) {
                                    // We have handled this 2 key codes onkeydown, so must do nothing here
                                } else {
                                    startFetching = true;
                                }
                                break;

                            case DEFS.keyCode.esc:
                                if(inputAutocompltList.isOpen()) {
                                    // When pressing the ESC key, let's resume back to the original user input
                                    input.value = inputAutocompltCurrentTarget;
                                    input.autocomplt.close();
                                }
                                break;

                            case DEFS.keyCode.enter:
                                if(inputAutocompltList.isOpen()) {
                                    // When pressing the enter key, let's try autocomplete
                                    inputAutocompltCompleteInput.call(input);
                                    input.autocomplt.close();
                                }
                                break;

                            default:
                                startFetching = true;
                                break;
                        }

                        if(startFetching) {
                            if(input.value.length > 0) {
                                inputAutocompltStartFetcher.call(input);
                            } else {
                                input.autocomplt.close();
                            }
                        }
                    }
                };

            input.autocomplt.setHintsFetcher = function(hintsFetcher) {
                if(typeof hintsFetcher !== 'function') {
                    return;
                }

                inputAutocompltHintsFetcher = hintsFetcher;
            };

            input.autocomplt.config = function(params) {
                var buf,
                    pms = {};

                // Config the fetching delay timing
                buf = Math.floor(params.delay);
                if(buf > 0) {
                    inputAutocompltDelay = pms.delay = buf;
                }

                // Config the max number of displayed hints
                buf = Math.floor(params.maxHintNum);
                if(buf > 0) {
                    inputAutocompltList.maxHintNum = pms.maxHintNum = buf;
                }

                // Config the list width
                inputAutocompltList.autoWidth = pms.autoWidth = params.width === 'auto';

                return pms;
            };

            input.autocomplt.setStyles = function(targetClass, styles) {
                var tStyles,
                    adjStyleAttrs,
                    newStyles = false;

                // Let's find out which the target UI part is being set
                switch(targetClass) {
                    case DEFS.autocompltListClass:
                        tStyles = inputAutocompltList.styles.autocompltList;
                        adjStyleAttrs = DEFS.adjStyleAttrs.autocompltList;
                        break;

                    case DEFS.autocompltHintClass:
                        tStyles = inputAutocompltList.styles.autocompltHint;
                        adjStyleAttrs = DEFS.adjStyleAttrs.autocompltHint;
                        break;

                    case DEFS.autocompltHintSelectedClass:
                        tStyles = inputAutocompltList.styles.autocompltHintSelected;
                        adjStyleAttrs = DEFS.adjStyleAttrs.autocompltHintSelected;
                        break;
                }

                if(typeof styles === 'object' && tStyles && adjStyleAttrs) {

                    for(var i = 0; i < adjStyleAttrs.length; i++) {

                        if(typeof styles[adjStyleAttrs[i]] === 'string' || typeof styles[adjStyleAttrs[i]] === 'number') {
                            if(!newStyles) {
                                newStyles = {};
                            }
                            newStyles[adjStyleAttrs[i]] = tStyles[adjStyleAttrs[i]] = styles[adjStyleAttrs[i]];
                        }

                    }

                }

                return newStyles;
            };

            input.autocomplt.close = function() {
                // Closing means no need for autocomplete hint so no autocomplete target either
                inputAutocompltCurrentTarget = '';
                inputAutocompltList.close();
            };

            input.autocomplt.enable = function() {
                inputAutocompltEnabled = true;
            };

            input.autocomplt.disable = function() {
                this.close();
                inputAutocompltEnabled = false;
            };

            input.autocomplt.destroy = function() {
                removeEvent(input, 'blur',    inputAutocompltBlurEvtHandle);
                removeEvent(input, 'keyup',   inputAutocompltKeyEvtHandle);
                removeEvent(input, 'keydown', inputAutocompltKeyEvtHandle);
                this.close();
                delete input.autocomplt;
            };

            addEvent(input, 'blur',    inputAutocompltBlurEvtHandle);
            addEvent(input, 'keyup',   inputAutocompltKeyEvtHandle);
            addEvent(input, 'keydown', inputAutocompltKeyEvtHandle);

            if(typeof params === 'object') {
                input.autocomplt.config(params);
                input.autocomplt.setHintsFetcher(params.hintsFetcher);
            }

            return input;
        }

    };

    // conflict management — save link to previous content of autocomplt, whatever it was.
    var prevAutocomplt = root.autocomplt;
    /**
     * Cleans global namespace, restoring previous value of window.autocomplt, and returns autocomplt itself.
     * @return {autocomplt}
     */
    autocomplt.noConflict = function() {
        root.autocomplt = prevAutocomplt;
        return this;
    };

    return autocomplt;
}));
