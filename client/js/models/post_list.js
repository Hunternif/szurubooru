"use strict";

const settings = require("../models/settings.js");
const api = require("../api.js");
const uri = require("../util/uri.js");
const AbstractList = require("./abstract_list.js");
const Post = require("./post.js");

class PostList extends AbstractList {
    static getAround(id, searchQuery, cachenumber) {
        return api.get(
            uri.formatApiLink("post", id, "around", {
                query: PostList.decorateSearchQuery(searchQuery || ""),
                fields: "id",
                cachenumber: cachenumber,
            })
        );
    }

    static search(text, offset, limit, fields, cachenumber) {
        return api
            .get(
                uri.formatApiLink("posts", {
                    query: PostList.decorateSearchQuery(text || ""),
                    offset: offset,
                    limit: limit,
                    fields: fields.join(","),
                    cachenumber: cachenumber,
                })
            )
            .then((response) => {
                return Promise.resolve(
                    Object.assign({}, response, {
                        results: PostList.fromResponse(response.results),
                    })
                );
            });
    }

    static getMedian(text, fields) {
        return api
            .get(
                uri.formatApiLink("posts", "median", {
                    query: PostList.decorateSearchQuery(text || ""),
                    fields: fields.join(","),
                })
            )
            .then((response) => {
                return Promise.resolve(
                    Object.assign({}, response, {
                        results: PostList.fromResponse(response.results)
                    })
                );
            });
    }

    static reverseSearch(id, limit, threshold, fields) {
        return api
            .get(
                uri.formatApiLink("post", id, "reverse-search", {
                    query: PostList.decorateSearchQuery(""), 
                    limit: limit,
                    threshold: threshold,
                    fields: fields.join(","),
                })
            )
            .then((response) => {
                const results = response.similarPosts.map((sim) => sim.post);
                return Promise.resolve(
                    Object.assign({}, response, {
                        results: PostList.fromResponse(results)
                    })
                );
            });
    }

    static decorateSearchQuery(text) {
        const browsingSettings = settings.get();
        const disabledSafety = [];
        if (api.safetyEnabled()) {
            for (let key of Object.keys(browsingSettings.listPosts)) {
                if (browsingSettings.listPosts[key] === false) {
                    disabledSafety.push(key);
                }
            }
            if (disabledSafety.length) {
                text = `-rating:${disabledSafety.join(",")} ${text}`;
            }
        }
        return text.trim();
    }

    hasPostId(testId) {
        for (let post of this._list) {
            if (post.id === testId) {
                return true;
            }
        }
        return false;
    }

    addById(id) {
        if (this.hasPostId(id)) {
            return;
        }

        let post = Post.fromResponse({ id: id });
        this.add(post);
    }

    removeById(testId) {
        for (let post of this._list) {
            if (post.id === testId) {
                this.remove(post);
            }
        }
    }
}

PostList._itemClass = Post;
PostList._itemName = "post";

module.exports = PostList;
