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
        // hack to override 'Enter' and 'Tab' keys
        this._tagify.events.callbacks.onKeydown = this._overrideKeyDown;

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

    _overrideKeyDown(e){
        const s = e.target.textContent.trim();

        this.trigger("keydown", {originalEvent: this._tagify.cloneEvent(e)});

        // ignore 'mix' mode

        switch( e.key ){
            case 'Backspace' :
                if( s === "" || s.charCodeAt(0) === 8203 ){  // 8203: ZERO WIDTH SPACE unicode
                    // timeout reason: when edited tag gets focused and the caret is placed at the end,
                    // the last character gets deleted (because of backspace)
                    setTimeout(this._tagify.editTag.bind(this), 0)
                }
                break;

            case 'Esc' :
            case 'Escape' :
                e.target.blur();
                break;

            case 'Space' :
                e.preventDefault(); // solves Chrome bug - http://stackoverflow.com/a/20398191/104380
                // because the main "keydown" event is bound before the dropdown events, this will fire first and will not *yet*
                // know if an option was just selected from the dropdown menu. If an option was selected,
                // the dropdown events should handle adding the tag
                setTimeout(()=>{
                    if( this._autoCompleteControl.visible )
                        return
                    this._tagify.addTags(s, true)
                })
        }
    }
}

module.exports = QueryTermsControl;
