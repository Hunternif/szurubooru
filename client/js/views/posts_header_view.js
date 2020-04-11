'use strict';

const events = require('../events.js');
const settings = require('../models/settings.js');
const keyboard = require('../util/keyboard.js');
const misc = require('../util/misc.js');
const search = require('../util/search.js');
const views = require('../util/views.js');
const TagAutoCompleteControl =
    require('../controls/tag_auto_complete_control.js');
const MetricHeaderControl = require('../controls/metric_header_control');
const QueryTermsControl = require('../controls/query_terms_control');

const template = views.getTemplate('posts-header');

class BulkEditor extends events.EventTarget {
    constructor(hostNode) {
        super();
        this._hostNode = hostNode;
        this._openLinkNode.addEventListener(
            'click', e => this._evtOpenLinkClick(e));
        this._closeLinkNode.addEventListener(
            'click', e => this._evtCloseLinkClick(e));
    }

    get opened() {
        return this._hostNode.classList.contains('opened') &&
            !this._hostNode.classList.contains('hidden');
    }

    get _openLinkNode() {
        return this._hostNode.querySelector('.open');
    }

    get _closeLinkNode() {
        return this._hostNode.querySelector('.close');
    }

    toggleOpen(state) {
        this._hostNode.classList.toggle('opened', state);
    }

    toggleHide(state) {
        this._hostNode.classList.toggle('hidden', state);
    }

    _evtOpenLinkClick(e) {
        throw new Error('Not implemented');
    }

    _evtCloseLinkClick(e) {
        throw new Error('Not implemented');
    }
}

class BulkSafetyEditor extends BulkEditor {
    constructor(hostNode) {
        super(hostNode);
    }

    _evtOpenLinkClick(e) {
        e.preventDefault();
        this.toggleOpen(true);
        this.dispatchEvent(new CustomEvent('open', {detail: {}}));
    }

    _evtCloseLinkClick(e) {
        e.preventDefault();
        this.toggleOpen(false);
        this.dispatchEvent(new CustomEvent('close', {detail: {}}));
    }
}

class BulkTagEditor extends BulkEditor {
    constructor(hostNode) {
        super(hostNode);
        this._autoCompleteControl = new TagAutoCompleteControl(
            this._inputNode,
            {
                confirm: tag =>
                    this._autoCompleteControl.replaceSelectedText(
                        tag.names[0], false),
            });
        this._hostNode.addEventListener('submit', e => this._evtFormSubmit(e));
    }

    get value() {
        return this._inputNode.value;
    }

    get _inputNode() {
        return this._hostNode.querySelector('input[name=tag]');
    }

    focus() {
        this._inputNode.focus();
    }

    blur() {
        this._autoCompleteControl.hide();
        this._inputNode.blur();
    }

    _evtFormSubmit(e) {
        e.preventDefault();
        this.dispatchEvent(new CustomEvent('submit', {detail: {}}));
    }

    _evtOpenLinkClick(e) {
        e.preventDefault();
        this.toggleOpen(true);
        this.focus();
        this.dispatchEvent(new CustomEvent('open', {detail: {}}));
    }

    _evtCloseLinkClick(e) {
        e.preventDefault();
        this._inputNode.value = '';
        this.toggleOpen(false);
        this.blur();
        this.dispatchEvent(new CustomEvent('close', {detail: {}}));
    }
}

class BulkAddRelationEditor extends BulkEditor {
    constructor(hostNode) {
        super(hostNode);
    }

    _evtOpenLinkClick(e) {
        e.preventDefault();
        this.toggleOpen(true);
        this.dispatchEvent(new CustomEvent('open', {detail: {}}));
    }

    _evtCloseLinkClick(e) {
        e.preventDefault();
        this.toggleOpen(false);
        this.dispatchEvent(new CustomEvent('close', {detail: {}}));
    }
}

class PostsHeaderView extends events.EventTarget {
    constructor(ctx) {
        super();

        ctx.settings = settings.get();
        this._ctx = ctx;
        this._hostNode = ctx.hostNode;
        views.replaceContent(this._hostNode, template(ctx));

        // Set up Tagify input
        this._queryInputNode.hidden = true;
        this._queryTermsControl = new QueryTermsControl(this._tagifyNode, ctx);
        this._queryTermsControl.addEventListener('change', e => this._evtTermsChange(e));

        this._autoCompleteControl = new TagAutoCompleteControl(
            this._tagifyInputNode,
            {
                confirm: tag =>
                    this._autoCompleteControl.replaceSelectedText(
                        misc.escapeSearchTerm(tag.names[0]), true),
            });

        keyboard.bind('p', () => this._focusFirstPostNode());
        search.searchInputNodeFocusHelper(this._tagifyInputNode);

        for (let safetyButtonNode of this._safetyButtonNodes) {
            safetyButtonNode.addEventListener(
                'click', e => this._evtSafetyButtonClick(e));
        }
        this._formNode.addEventListener('submit', e => this._evtFormSubmit(e));
        this._randomizeButtonNode.addEventListener('click', e => this._evtRandomizeButtonClick(e));

        this._bulkEditors = [];
        if (this._bulkEditTagsNode) {
            this._bulkTagEditor = new BulkTagEditor(this._bulkEditTagsNode);
            this._bulkEditors.push(this._bulkTagEditor);
        }

        if (this._bulkEditSafetyNode) {
            this._bulkSafetyEditor = new BulkSafetyEditor(
                this._bulkEditSafetyNode);
            this._bulkEditors.push(this._bulkSafetyEditor);
        }

        if (this._bulkAddRelationNode) {
            this._bulkAddRelationEditor = new BulkAddRelationEditor(
                this._bulkAddRelationNode);
            this._bulkEditors.push(this._bulkAddRelationEditor);
        }

        this._bulkEditOpenButtonNode.addEventListener(
            'click', e => this._evtOpenBulkEditBtnClick(e));
        this._bulkEditCloseButtonNode.addEventListener(
            'click', e => this._evtCloseBulkEditBtnClick(e));

        if (this._metricsButtonHolderNode) {
            this._metricControl = new MetricHeaderControl(this._metricsBlockNode, ctx);
            this._metricControl.addEventListener('submit', e => {
                this._navigate();
            });
            this._metricsOpenButtonNode.addEventListener(
                'click', e => this._evtOpenMetricsBtnClick(e));
            this._metricsCloseButtonNode.addEventListener(
                'click', e => this._evtCloseMetricsBtnClick(e));
        }

        for (let editor of this._bulkEditors) {
            editor.addEventListener('submit', e => {
                this._navigate();
            });
            editor.addEventListener('open', e => {
                this._hideBulkEditorsExcept(editor);
                this._navigate();
            });
            editor.addEventListener('close', e => {
                this._closeAndShowAllBulkEditors();
                this._navigate();
            });
        }

        if (ctx.parameters.tag && this._bulkTagEditor) {
            this._openBulkEditor(this._bulkTagEditor);
        } else if (ctx.parameters.safety && this._bulkSafetyEditor) {
            this._openBulkEditor(this._bulkSafetyEditor);
        } else if (ctx.parameters.relations && this._bulkAddRelationEditor) {
            this._openBulkEditor(this._bulkAddRelationEditor);
        }
        if (ctx.parameters.metrics && this._metricsBlockNode) {
            this._toggleMetricsBlock(true);
        }
    }

    get _formNode() {
        return this._hostNode.querySelector('form.search');
    }

    get _safetyButtonNodes() {
        return this._hostNode.querySelectorAll('form .safety');
    }

    get _queryInputNode() {
        return this._hostNode.querySelector('form [name=search-text]');
    }

    get _tagifyNode() {
        return this._hostNode.querySelector('form [name=tagify_placeholder]');
    }

    get _tagifyInputNode() {
        return this._hostNode.querySelector('form .tagify__input');
    }

    get _randomizeButtonNode() {
        return this._hostNode.querySelector('#randomize-button');
    }

    get _bulkEditBtnHolderNode() {
        return this._hostNode.querySelector('.bulk-edit-btn-holder');
    }

    get _bulkEditOpenButtonNode() {
        return this._hostNode.querySelector('.bulk-edit-btn.open');
    }

    get _bulkEditCloseButtonNode() {
        return this._hostNode.querySelector('.bulk-edit-btn.close');
    }

    get _bulkEditBlockNode() {
        return this._hostNode.querySelector('.bulk-edit-block');
    }

    get _bulkEditTagsNode() {
        return this._hostNode.querySelector('.bulk-edit-tags');
    }

    get _bulkEditSafetyNode() {
        return this._hostNode.querySelector('.bulk-edit-safety');
    }

    get _bulkAddRelationNode() {
        return this._hostNode.querySelector('.bulk-add-relation');
    }

    get _metricsButtonHolderNode() {
        return this._hostNode.querySelector('.metrics-btn-holder');
    }

    get _metricsOpenButtonNode() {
        return this._hostNode.querySelector('.metrics-btn.open');
    }

    get _metricsCloseButtonNode() {
        return this._hostNode.querySelector('.metrics-btn.close');
    }

    get _metricsBlockNode() {
        return this._hostNode.querySelector('.metrics-block');
    }

    _evtOpenBulkEditBtnClick(e) {
        e.preventDefault();
        this._toggleBulkEditBlock(true);
        this._navigate();
    }

    _evtCloseBulkEditBtnClick(e) {
        e.preventDefault();
        this._toggleBulkEditBlock(false);
        this._closeAndShowAllBulkEditors();
        this._navigate();
    }

    _openBulkEditor(editor) {
        editor.toggleOpen(true);
        this._toggleBulkEditBlock(true);
        this._hideBulkEditorsExcept(editor);
    }

    _toggleBulkEditBlock(open) {
        this._bulkEditBtnHolderNode.classList.toggle('opened', open);
        this._bulkEditBlockNode.classList.toggle('hidden', !open);
    }

    _hideBulkEditorsExcept(editor) {
        for (let otherEditor of this._bulkEditors) {
            if (otherEditor !== editor) {
                otherEditor.toggleOpen(false);
                otherEditor.toggleHide(true);
            }
        }
    }

    _closeAndShowAllBulkEditors() {
        for (let otherEditor of this._bulkEditors) {
            otherEditor.toggleOpen(false);
            otherEditor.toggleHide(false);
        }
    }

    _evtOpenMetricsBtnClick(e) {
        e.preventDefault();
        this._toggleMetricsBlock(true);
        this._navigate();
    }

    _evtCloseMetricsBtnClick(e) {
        e.preventDefault();
        this._toggleMetricsBlock(false);
        this._navigate();
    }

    _toggleMetricsBlock(open) {
        this._metricsButtonHolderNode.classList.toggle('opened', open);
        this._metricsBlockNode.classList.toggle('hidden', !open);
    }

    _evtSafetyButtonClick(e, url) {
        e.preventDefault();
        e.target.classList.toggle('disabled');
        const safety = e.target.getAttribute('data-safety');
        let browsingSettings = settings.get();
        browsingSettings.listPosts[safety] =
            !browsingSettings.listPosts[safety];
        settings.save(browsingSettings, true);
        this.dispatchEvent(
            new CustomEvent(
                'navigate', {
                    detail: {
                        parameters: Object.assign(
                            {}, this._ctx.parameters, {tag: null, offset: 0}),
                    },
                }));
    }

    _evtTermsChange(e) {
        this._queryInputNode.value = this._ctx.parameters.query;
        this._navigate();
    }

    _evtFormSubmit(e) {
        e.preventDefault();
        this._navigate();
        if (this._metricControl) {
            this._metricControl.refreshQuery(this._queryInputNode.value);
        }
    }
    _evtRandomizeButtonClick(e) {
        e.preventDefault();
        if (!this._queryInputNode.value.includes('sort:random')) {
            this._queryInputNode.value += ' sort:random';
        }
        this._ctx.parameters.cachenumber = Math.round(Math.random() * 1000);
        this._navigate();
    }

    _navigate() {
        this._autoCompleteControl.hide();
        let parameters = {
            query: this._queryInputNode.value,
            cachenumber: this._ctx.parameters.cachenumber,
            metrics: this._ctx.parameters.metrics,
        };
        parameters.offset = parameters.query === this._ctx.parameters.query ?
            this._ctx.parameters.offset : 0;
        if (this._bulkTagEditor && this._bulkTagEditor.opened) {
            parameters.tag = this._bulkTagEditor.value;
            this._bulkTagEditor.blur();
        } else {
            parameters.tag = null;
        }
        parameters.safety = (
            this._bulkSafetyEditor &&
            this._bulkSafetyEditor.opened ? '1' : null);
        parameters.relations = (
            this._bulkAddRelationEditor &&
            this._bulkAddRelationEditor.opened ? this._ctx.parameters.relations || ' ' : null);
        this.dispatchEvent(
            new CustomEvent('navigate', {detail: {parameters: parameters}}));
    }

    _focusFirstPostNode() {
        const firstPostNode =
            document.body.querySelector('.post-list li:first-child a');
        if (firstPostNode) {
            firstPostNode.focus();
        }
    }
}

module.exports = PostsHeaderView;
