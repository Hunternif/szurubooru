'use strict';

const TagAutoCompleteControl = require('./tag_auto_complete_control.js');

class TagifyAutoCompleteControl extends TagAutoCompleteControl {
    constructor(input, options) {
        options = Object.assign({
            getTextToFind: () => {
                return input.innerHTML;
            },
        }, options);

        super(input, options);
    }

    replaceSelectedText(result, addSpace) {
        this._sourceInputNode.innerHTML = result;
    }
}

module.exports = TagifyAutoCompleteControl;
