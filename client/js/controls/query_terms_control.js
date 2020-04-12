'use strict';

import Tagify from '@yaireo/tagify'

const misc = require('../util/misc.js');
const events = require('../events.js');
const TagifyAutoCompleteControl =
    require('../controls/tagify_auto_complete_control.js');

class QueryTermsControl extends events.EventTarget {
    constructor(hostNode, ctx) {
        super();
        this._ctx = ctx;
        this._hostNode = hostNode;

        this._tagify = new Tagify(hostNode, {
            delimiters: " ",
            mode: 'mix', // need this mode because it doesn't use 'Enter' or 'Tab' keys.
            pattern: "$$$$$$$", // fake pattern to prevent error
        });
        this._tagify.addTags(ctx.parameters.query, true);
        this._tagify.on('add', () => this._refreshQuery());
        this._tagify.on('remove', () => this._refreshQuery());

        this._autoCompleteControl = new TagifyAutoCompleteControl(
            this._tagifyInputNode,
            {
                confirm: tag => {
                    let term = misc.escapeSearchTerm(tag.names[0]);
                    this._tagify.addTags(term, true);
                }
            });
    }

    _refreshQuery() {
        this._ctx.parameters.query = this._tagify.value.map(term => term.value).join(' ');
        this._autoCompleteControl.hide();
        this.dispatchEvent(new CustomEvent('change'));
    }

    get _tagifyInputNode() {
        return this._tagify.DOM.input;
    }
}

module.exports = QueryTermsControl;
