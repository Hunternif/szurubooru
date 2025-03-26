from typing import Callable, Dict, List, Tuple, Union

import sqlalchemy as sa

from szurubooru import db, errors, model, rest
from szurubooru.func import cache
from szurubooru.search import parser, tokens
from szurubooru.search.configs.base_search_config import BaseSearchConfig
from szurubooru.search.query import SearchQuery
from szurubooru.search.typing import SaQuery


def _format_dict_keys(source: Dict) -> List[str]:
    return list(sorted(source.keys()))


def _get_order(order: str, default_order: str) -> Union[bool, str]:
    if order == tokens.SortToken.SORT_DEFAULT:
        return default_order or tokens.SortToken.SORT_ASC
    if order == tokens.SortToken.SORT_NEGATED_DEFAULT:
        if default_order == tokens.SortToken.SORT_ASC:
            return tokens.SortToken.SORT_DESC
        elif default_order == tokens.SortToken.SORT_DESC:
            return tokens.SortToken.SORT_ASC
        assert False
    return order


class Executor:
    """
    Class for search parsing and execution. Handles plaintext parsing and
    delegates sqlalchemy filter decoration to SearchConfig instances.
    """
    AROUND_NEXT = "up"
    AROUND_PREV = "down"

    def __init__(self, search_config: BaseSearchConfig) -> None:
        self.config = search_config
        self.parser = parser.Parser()

    def get_around(
        self, query_text: str, entity_id: int
    ) -> Tuple[model.Base, model.Base, model.Base]:
        search_query = self.parser.parse(query_text)
        self.config.on_search_query_parsed(search_query)
        filter_query = (
            self.config
                .create_around_query()
                .options(sa.orm.lazyload("*")))
        prev_filter_query = (
            self._prepare_sorted_around_query(
                filter_query, search_query, entity_id, self.AROUND_PREV
            ).limit(1))
        next_filter_query = (
            self._prepare_sorted_around_query(
                filter_query, search_query, entity_id, self.AROUND_NEXT
            ).limit(1))
        # random post
        if "sort:random" not in query_text:
            query_text = "sort:random " + query_text
        count, random_entities = self.execute(query_text, 0, 1)
        return (
            prev_filter_query.one_or_none(),
            next_filter_query.one_or_none(),
            random_entities[0] if random_entities else None
        )

    def get_around_and_serialize(
        self,
        ctx: rest.Context,
        entity_id: int,
        serializer: Callable[[model.Base], rest.Response],
    ) -> rest.Response:
        entities = self.get_around(
            ctx.get_param_as_string("query", default=""), entity_id
        )
        return {
            "prev": serializer(entities[0]),
            "next": serializer(entities[1]),
            "random": serializer(entities[2]),
        }

    def execute(
        self, query_text: str, offset: int, limit: int
    ) -> Tuple[int, List[model.Base]]:
        search_query = self.parser.parse(query_text)
        self.config.on_search_query_parsed(search_query)

        if offset < 0:
            limit = max(0, limit + offset)
            offset = 0

        disable_eager_loads = False
        for token in search_query.sort_tokens:
            if token.name == "random":
                disable_eager_loads = True


        can_list_unsafe = getattr(self.config, "can_list_unsafe", False)

        key = (id(self.config), hash(search_query), offset, limit, can_list_unsafe)
        if not disable_eager_loads and cache.has(key):
            return cache.get(key)

        filter_query = self.config.create_filter_query(disable_eager_loads)
        filter_query = filter_query.options(sa.orm.lazyload("*"))
        filter_query = self._prepare_db_query(filter_query, search_query, True)
        entities = filter_query.offset(offset).limit(limit).all()

        count_query = self.config.create_count_query(disable_eager_loads)
        count_query = count_query.options(sa.orm.lazyload("*"))
        count_query = self._prepare_db_query(count_query, search_query, False)
        count_statement = count_query.statement.with_only_columns(
            [sa.func.count()]
        ).order_by(None)
        count = db.session.execute(count_statement).scalar()

        ret = (count, entities)
        cache.put(key, ret)
        return ret

    def execute_and_serialize(
        self,
        ctx: rest.Context,
        serializer: Callable[[model.Base], rest.Response],
    ) -> rest.Response:
        query = ctx.get_param_as_string("query", default="")
        offset = ctx.get_param_as_int("offset", default=0, min=0)
        limit = ctx.get_param_as_int("limit", default=100, min=1, max=100)
        count, entities = self.execute(query, offset, limit)
        return {
            "query": query,
            "offset": offset,
            "limit": limit,
            "total": count,
            "results": list([serializer(entity) for entity in entities]),
        }

    def count(self, query_text:str) -> int:
        search_query = self.parser.parse(query_text)
        self.config.on_search_query_parsed(search_query)
        count_query = self.config.create_count_query(True)
        count_query = count_query.options(sa.orm.lazyload("*"))
        count_query = self._prepare_db_query(count_query, search_query, False)
        count_statement = (
            count_query
            .statement
            .with_only_columns([sa.func.count()])
            .order_by(None))
        count = db.session.execute(count_statement).scalar()
        return count

    def _prepare_db_query(
        self, db_query: SaQuery, search_query: SearchQuery, use_sort: bool
    ) -> SaQuery:
        for anon_token in search_query.anonymous_tokens:
            if not self.config.anonymous_filter:
                raise errors.SearchError(
                    "Anonymous tokens are not valid in this context."
                )
            db_query = self.config.anonymous_filter(
                db_query, anon_token.criterion, anon_token.negated
            )

        for named_token in search_query.named_tokens:
            if named_token.name not in self.config.named_filters:
                raise errors.SearchError(
                    "Unknown named token: %r. Available named tokens: %r."
                    % (
                        named_token.name,
                        _format_dict_keys(self.config.named_filters),
                    )
                )
            db_query = self.config.named_filters[named_token.name](
                db_query, named_token.criterion, named_token.negated
            )

        for sp_token in search_query.special_tokens:
            if sp_token.value not in self.config.special_filters:
                raise errors.SearchError(
                    "Unknown special token: %r. "
                    "Available special tokens: %r."
                    % (
                        sp_token.value,
                        _format_dict_keys(self.config.special_filters),
                    )
                )
            db_query = self.config.special_filters[sp_token.value](
                db_query, None, sp_token.negated
            )

        if use_sort:
            for sort_token in search_query.sort_tokens:
                if sort_token.name not in self.config.sort_columns:
                    raise errors.SearchError(
                        "Unknown sort token: %r. "
                        "Available sort tokens: %r."
                        % (
                            sort_token.name,
                            _format_dict_keys(self.config.sort_columns),
                        )
                    )
                column, default_order = self.config.sort_columns[
                    sort_token.name
                ]
                order = _get_order(sort_token.order, default_order)
                if order == sort_token.SORT_ASC:
                    db_query = db_query.order_by(column.asc())
                elif order == sort_token.SORT_DESC:
                    db_query = db_query.order_by(column.desc())

        db_query = self.config.finalize_query(db_query)
        return db_query

    def _prepare_sorted_around_query(
            self,
            db_query: SaQuery,
            search_query: SearchQuery,
            entity_id: int,
            direction: str):
        db_query = self._prepare_db_query(db_query, search_query, False)
        db_query = db_query.order_by(None)
        found_sort_column = False

        for sort_token in search_query.sort_tokens:
            if sort_token.name == "random":
                continue
            if sort_token.name not in self.config.sort_columns:
                raise errors.SearchError(
                    "Unknown sort token: %r. "
                    "Available sort tokens: %r." % (
                        sort_token.name,
                        _format_dict_keys(self.config.sort_columns)))
            column, default_order = (
                self.config.sort_columns[sort_token.name])
            order = _get_order(sort_token.order, default_order)

            # the order column may be joined, so we need to query its value:
            column_query = (
                db.session.query(self.config.id_column, column)
                .options(sa.orm.lazyload("*")))
            column_query = (
                # empty search query because we already know entity id
                self._prepare_db_query(column_query, SearchQuery(), False)
                .filter(self.config.id_column == entity_id))
            id, column_value = column_query.one_or_none()
            # it's possible that this entity doesn't have the column
            if not column_value:
                continue
            found_sort_column = True

            if order == sort_token.SORT_ASC:
                if direction == self.AROUND_NEXT:
                    db_query = (
                        db_query
                        .order_by(column.asc())
                        .filter(column > column_value))
                elif direction == self.AROUND_PREV:
                    db_query = (
                        db_query
                        .order_by(column.desc())
                        .filter(column < column_value))
            elif order == sort_token.SORT_DESC:
                if direction == self.AROUND_NEXT:
                    db_query = (
                        db_query
                        .order_by(column.desc())
                        .filter(column < column_value))
                elif direction == self.AROUND_PREV:
                    db_query = (
                        db_query
                        .order_by(column.asc())
                        .filter(column > column_value))

        if not found_sort_column:
            # no sorting, use default sorting by id
            if direction == self.AROUND_NEXT:
                db_query = db_query.filter(self.config.id_column < entity_id)
            elif direction == self.AROUND_PREV:
                db_query = db_query.filter(self.config.id_column > entity_id)
            db_query = db_query.order_by(
                sa.func.abs(self.config.id_column - entity_id).asc())
            return db_query

        return db_query
