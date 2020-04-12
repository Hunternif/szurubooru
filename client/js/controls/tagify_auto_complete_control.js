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
}

module.exports = TagifyAutoCompleteControl;
