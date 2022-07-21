"use strict";

const router = require("../router.js");
const api = require("../api.js");
const settings = require("../models/settings.js");
const tags = require("../tags.js");
const uri = require("../util/uri.js");
const PostList = require("../models/post_list.js");
const topNavigation = require("../models/top_navigation.js");
const PageController = require("../controllers/page_controller.js");
const PostsHeaderView = require("../views/posts_header_view.js");
const PostsPageView = require("../views/posts_page_view.js");
const EmptyView = require("../views/empty_view.js");

const fields = [
    "id",
    "thumbnailUrl",
    "type",
    "safety",
    "score",
    "favoriteCount",
    "commentCount",
    "tags",
    "version",
];

class PostListController {
    constructor(ctx) {
        this._pageController = new PageController();

        if (!api.hasPrivilege("posts:list")) {
            this._view = new EmptyView();
            this._view.showError("You don't have privileges to view posts.");
            return;
        }

        this._ctx = ctx;

        topNavigation.activate("posts");
        topNavigation.setTitle("Listing posts");

        this._headerView = new PostsHeaderView({
            hostNode: this._pageController.view.pageHeaderHolderNode,
            parameters: ctx.parameters,
            isLoggedIn: api.isLoggedIn(),
            enableSafety: api.safetyEnabled(),
            canBulkEditTags: api.hasPrivilege("posts:bulk-edit:tags"),
            canBulkEditSafety: api.hasPrivilege("posts:bulk-edit:safety"),
            canViewMetrics: api.hasPrivilege("metrics:list"),
            bulkEdit: {
                tags: this._bulkEditTags,
            },
        });
        this._headerView.addEventListener("navigate", (e) =>
            this._evtNavigate(e)
        );

        this._syncPageController();
    }

    showSuccess(message) {
        this._pageController.showSuccess(message);
    }

    showError(message) {
        this._pageController.showError(message);
    }

    get _bulkEditTags() {
        return (this._ctx.parameters.tag || "").split(/\s+/).filter((s) => s);
    }

    get _bulkEditRelationsIds() {
        return (this._ctx.parameters.relations || "").split(/\s+/).filter(s => s)
            .map(id => parseInt(id));
    }

    _evtNavigate(e) {
        router.showNoDispatch(
            uri.formatClientLink("posts", e.detail.parameters)
        );
        Object.assign(this._ctx.parameters, e.detail.parameters);
        this._bulkEditTags.map((tagName) =>
            tags.resolveTagAndCategory(tagName)
                .catch((error) => window.alert(error.message))
        );
        this._syncPageController();
    }

    _evtTag(e) {
        Promise.all(
            this._bulkEditTags.map((tag) => {
                let tagData = tags.parseTagAndCategory(tag);
                return e.detail.post.tags.addByName(tagData.name);
            })
        )
            .then(e.detail.post.save())
            .catch((error) => window.alert(error.message));
    }

    _evtUntag(e) {
        for (let tag of this._bulkEditTags) {
            let tagData = tags.parseTagAndCategory(tag);
            e.detail.post.tags.removeByName(tagData.name);
        }
        e.detail.post.save().catch((error) => window.alert(error.message));
    }

    _evtChangeSafety(e) {
        e.detail.post.safety = e.detail.safety;
        e.detail.post.save().catch((error) => window.alert(error.message));
    }

    _evtAddRelation(e) {
        let addedPost = e.detail.post;
        // If we're just starting to build this instance of relations,
        // use the first post's list:
        let relations = this._bulkEditRelationsIds || addedPost.relations;
        for (let relationId of relations) {
            addedPost.relations.push(relationId);
        }
        // Only save the updated post, the relationship will propagate to
        // others automatically
        addedPost.save().catch((error) => window.alert(error.message));
        relations.push(addedPost.id);
        this._updateRelationsForBulkEdit(relations);

    }

    _evtRemoveRelation(e) {
        let removedPost = e.detail.post;
        let relations = this._bulkEditRelationsIds;
        removedPost.relations = removedPost.relations
            .filter((id)=> !relations.some((relationId) => relationId == id));
        // Only save the updated post, the relationship will propagate to others automatically
        removedPost.save().catch((error) => window.alert(error.message));
        relations = relations.filter((id) => id != removedPost.id);
        this._updateRelationsForBulkEdit(relations);
    }

    _updateRelationsForBulkEdit(relations) {
        //Whitespace instead of empty string so that it stays part of the query:
        this._ctx.parameters.relations = relations.join(" ") || " ";
    }

    _syncPageController() {
        this._pageController.run({
            parameters: this._ctx.parameters,
            browserState: this._ctx.state,
            defaultLimit: parseInt(settings.get().postsPerPage),
            getClientUrlForPage: (offset, limit) => {
                const parameters = Object.assign({}, this._ctx.parameters, {
                    offset: offset,
                    limit: limit,
                });
                return uri.formatClientLink("posts", parameters);
            },
            requestPage: (offset, limit) => {
                let query = uri.getPostsQuery(this._ctx.parameters);
                return PostList.search(
                    query,
                    offset,
                    limit,
                    fields,
                    this._ctx.parameters.cachenumber
                );
            },
            pageRenderer: (pageCtx) => {
                Object.assign(pageCtx, {
                    canViewPosts: api.hasPrivilege("posts:view"),
                    canBulkEditTags: api.hasPrivilege("posts:bulk-edit:tags"),
                    canBulkEditSafety: api.hasPrivilege(
                        "posts:bulk-edit:safety"
                    ),
                    canViewMetrics: api.hasPrivilege("metrics:list"),
                    bulkEdit: {
                        tags: this._bulkEditTags,
                        relations: this._ctx.parameters.relations,
                    },
                    postFlow: settings.get().postFlow,
                });
                const view = new PostsPageView(pageCtx);
                view.addEventListener("tag", (e) => this._evtTag(e));
                view.addEventListener("untag", (e) => this._evtUntag(e));
                view.addEventListener("changeSafety", (e) =>
                    this._evtChangeSafety(e)
                );
                view.addEventListener("addRelation", (e) =>
                    this._evtAddRelation(e)
                );
                view.addEventListener("removeRelation", (e) =>
                    this._evtRemoveRelation(e)
                );
                return view;
            },
        });
    }
}

module.exports = (router) => {
    router.enter(["posts"], (ctx, next) => {
        ctx.controller = new PostListController(ctx);
    });
};
