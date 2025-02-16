from datetime import datetime
from unittest.mock import patch

import pytest

from szurubooru import api, db, errors, model
from szurubooru.func import posts


@pytest.fixture(autouse=True)
def inject_config(config_injector):
    config_injector(
        {
            "data_url": "http://example.com/",
            "secret": "test",
            "privileges": {
                "posts:list": model.User.RANK_REGULAR,
                "posts:view": model.User.RANK_REGULAR,
                "posts:view:unsafe": model.User.RANK_REGULAR,
            },
        }
    )


def test_retrieving_multiple(user_factory, post_factory, context_factory):
    post1 = post_factory(id=1)
    post2 = post_factory(id=2)
    db.session.add_all([post1, post2])
    db.session.flush()
    with patch("szurubooru.func.posts.serialize_post"):
        posts.serialize_post.return_value = "serialized post"
        result = api.post_api.get_posts(
            context_factory(
                params={"query": "", "offset": 0},
                user=user_factory(rank=model.User.RANK_REGULAR),
            )
        )
        assert result == {
            "query": "",
            "offset": 0,
            "limit": 100,
            "total": 2,
            "results": ["serialized post", "serialized post"],
        }


def test_using_special_tokens(user_factory, post_factory, context_factory):
    auth_user = user_factory(rank=model.User.RANK_REGULAR)
    post1 = post_factory(id=1)
    post2 = post_factory(id=2)
    post1.favorited_by = [
        model.PostFavorite(user=auth_user, time=datetime.utcnow())
    ]
    db.session.add_all([post1, post2, auth_user])
    db.session.flush()
    with patch("szurubooru.func.posts.serialize_post"):
        posts.serialize_post.side_effect = (
            lambda post, *_args, **_kwargs: "serialized post %d" % post.post_id
        )
        result = api.post_api.get_posts(
            context_factory(
                params={"query": "special:fav", "offset": 0}, user=auth_user
            )
        )
        assert result == {
            "query": "special:fav",
            "offset": 0,
            "limit": 100,
            "total": 1,
            "results": ["serialized post 1"],
        }


def test_trying_to_use_special_tokens_without_logging_in(
    user_factory, context_factory, config_injector
):
    config_injector(
        {
            "privileges": {
                "posts:list": "anonymous",
                "posts:list:unsafe": "regular",
            },
        }
    )
    with pytest.raises(errors.SearchError):
        api.post_api.get_posts(
            context_factory(
                params={"query": "special:fav", "offset": 0},
                user=user_factory(rank=model.User.RANK_ANONYMOUS),
            )
        )


def test_trying_to_retrieve_multiple_without_privileges(
    user_factory, context_factory
):
    with pytest.raises(errors.AuthError):
        api.post_api.get_posts(
            context_factory(
                params={"query": "", "offset": 0},
                user=user_factory(rank=model.User.RANK_ANONYMOUS),
            )
        )


def test_retrieving_single(user_factory, post_factory, context_factory):
    db.session.add(post_factory(id=1))
    db.session.flush()
    with patch("szurubooru.func.posts.serialize_post"):
        posts.serialize_post.return_value = "serialized post"
        result = api.post_api.get_post(
            context_factory(user=user_factory(rank=model.User.RANK_REGULAR)),
            {"post_id": 1},
        )
        assert result == "serialized post"


def test_trying_to_retrieve_single_non_existing(user_factory, context_factory):
    with pytest.raises(posts.PostNotFoundError):
        api.post_api.get_post(
            context_factory(user=user_factory(rank=model.User.RANK_REGULAR)),
            {"post_id": 999},
        )


def test_trying_to_retrieve_single_without_privileges(
    user_factory, context_factory
):
    with pytest.raises(errors.AuthError):
        api.post_api.get_post(
            context_factory(user=user_factory(rank=model.User.RANK_ANONYMOUS)),
            {"post_id": 999},
        )


@pytest.mark.parametrize(
    "query,expected_id",
    [
        ("sort:id,asc", 2),
        ("sort:id,asc id:2..", 2),
        ("sort:id,desc id:2..", 3),
        ("sort:id,asc id:3..", 3),
        ("sort:id,desc id:3..", 3),
        ("sort:id id:4..", None),
        ("sort:tag-count", 3),
        ("sort:tag-count,asc id:..2", 1),
        ("sort:tag-count,desc id:..2", 2),
    ],
)
def test_median(
    query,
    expected_id,
    post_factory,
    tag_factory,
    context_factory,
    user_factory,
):
    tag1 = tag_factory()
    tag2 = tag_factory()
    tag3 = tag_factory()
    post1 = post_factory(id=1, tags=[tag1])
    post2 = post_factory(id=2, tags=[tag1, tag2, tag3])
    post3 = post_factory(id=3, tags=[tag1, tag2])
    db.session.add_all([tag1, tag2, tag3, post1, post2, post3])
    db.session.flush()
    with patch("szurubooru.func.comments.serialize_comment"), patch(
        "szurubooru.func.users.serialize_micro_user"
    ), patch("szurubooru.func.posts.files.has"):
        response = api.post_api.get_posts_median(
            context_factory(
                params={"query": query},
                user=user_factory(rank=model.User.RANK_REGULAR),
            )
        )
    if not expected_id:
        assert response["total"] == 0
        assert len(response["results"]) == 0
    else:
        assert response["total"] == 1
        assert response["results"][0]["id"] == expected_id


def test_trying_to_retrieve_unsafe_without_privileges(
    user_factory, context_factory, post_factory, config_injector
):
    config_injector(
        {
            "privileges": {
                "posts:view": "anonymous",
                "posts:view:unsafe": "regular",
            },
        }
    )
    db.session.add(post_factory(id=1, safety=model.Post.SAFETY_UNSAFE))
    db.session.flush()
    with pytest.raises(errors.AuthError):
        api.post_api.get_post(
            context_factory(user=user_factory(rank=model.User.RANK_ANONYMOUS)),
            {"post_id": 1},
        )
