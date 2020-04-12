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
        });
        this._tagify.addTags(ctx.parameters.query, true);
        this._tagify.on('add', () => this._refreshQuery());
        this._tagify.on('remove', () => this._refreshQuery());

        this._tagifyInputNode.addEventListener('keydown', e => this._overrideKeyDown(e))

        this._autoCompleteControl = new TagifyAutoCompleteControl(
            this._tagifyInputNode,
            {
                confirm: tag => {
                    let term = misc.escapeSearchTerm(tag.names[0]);
                    this._tagify.addTags(term, true);
                }
            });
    }

    _overrideKeyDown(e) {
        switch (e.key) {
            case 'Enter':
            case 'Tab':
                if (this._autoCompleteControl.visible) {
                    //Hack: prevent typing in Tagify when our custom auto-complete menu is shown
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
        }
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
