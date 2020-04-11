'use strict';

import Tagify from '@yaireo/tagify'
const events = require('../events.js');

class QueryTermsControl extends events.EventTarget {
    constructor(hostNode, ctx) {
        super();
        this._ctx = ctx;
        this._hostNode = hostNode;

        this._tagify = new Tagify(hostNode, { delimiters: " " });
        this._tagify.addTags(ctx.parameters.query, true);
        this._tagify.on('add', () => this._refreshQuery());
        this._tagify.on('remove', () => this._refreshQuery());
    }

    _refreshQuery() {
        this._ctx.parameters.query = this._tagify.value.map(term => term.value).join(' ');
        this.dispatchEvent(new CustomEvent('change'));
    }
}

module.exports = QueryTermsControl;
