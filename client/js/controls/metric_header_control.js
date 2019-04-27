'use strict';

const events = require('../events.js');
const misc = require('../util/misc.js');
const views = require('../util/views.js');
const MetricList = require('../models/metric_list.js');

const mainTemplate = views.getTemplate('metric-header');
const metricItemTemplate = views.getTemplate('metric-header-item');

class MetricHeaderControl extends events.EventTarget {
    constructor(hostNode, ctx) {
        super();
        this._ctx = ctx;
        this._hostNode = hostNode;
        this._selectedMetrics = new MetricList();

        this._headerNode = mainTemplate(ctx);
        this._metricListNode = this._headerNode.querySelector('ul.metric-list');

        this._hostNode.insertBefore(
            this._headerNode, this._hostNode.nextSibling);

        MetricList.loadAll().then(response => {
            this._metrics = response.results;
            this._addSelectedMetrics(ctx.parameters.metrics);
            this._installMetrics(response.results);
        });
    }

    _addSelectedMetrics(metricsStr) {
        let selectedNames = (metricsStr || '').split(' ');
        for (let metric of [...this._metrics]) {
            if (selectedNames.includes(metric.tag.names[0])) {
                this._selectedMetrics.add(metric);
            }
        }
    }

    _installMetrics(metrics) {
        for (let metric of metrics) {
            const node = metricItemTemplate(Object.assign({},
                {
                    metric: metric,
                    selected: this._selectedMetrics.includes(metric),
                },
                this._ctx));
            node.addEventListener('click', e => this._evtMetricClicked(e, node, metric));
            this._metricListNode.appendChild(node);
        }
    }

    _evtMetricClicked(e, node, metric) {
        e.preventDefault();
        node.classList.toggle('selected');
        node.querySelector('a').classList.toggle('selected');
        if (this._selectedMetrics.includes(metric)) {
            this._selectedMetrics.remove(metric);
        } else {
            this._selectedMetrics.add(metric);
        }
        this._ctx.parameters = Object.assign({}, this._ctx.parameters, {
                metrics: this._selectedMetrics
                    .map(metric => metric.tag.names[0]).join(' ')
            });
        this.dispatchEvent(new CustomEvent('submit'));
    }
}

module.exports = MetricHeaderControl;
