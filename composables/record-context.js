/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { computed, toValue } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApiSiblings } from './realtime.js';

/**
 * The list a record is opened from, carried by the query of its route so a
 * reload keeps it: the filter the list sends, or the one of the group the
 * record is opened from, and its order.
 *
 * @param {{ combinedFilter: import('vue').Ref<any>, orderBy: import('vue').Ref<Array<string>|null> }} list - A data iterator
 * @param {{ group?: { filter: any }|null }} [options] - The group of a grouped list the record is opened from
 * @returns {{ ctx?: string }} Nothing for a list neither filtered nor ordered: an empty context stays out of the url
 */
export function listContext(list, { group = null } = {}) {
    const filter = group ? group.filter : toValue(list.combinedFilter);
    const orderBy = toValue(list.orderBy);
    const context = {
        ...(filter ? { f: filter } : {}),
        ...(orderBy?.length ? { o: orderBy } : {}),
    };

    return Object.keys(context).length ? { ctx: JSON.stringify(context) } : {};
}

/**
 * The records before and after the one a route shows, in the list it was
 * opened from. The server computes them on the same query as the list, so
 * they hold after a reload; stepping replaces the history entry, so going
 * back returns to the list rather than to each record seen.
 *
 * A record shown from its list without a context in its query is in the list
 * as it comes, unfiltered and in its default order: `listed` says when.
 *
 * @param {any} api - The api model of the record (useXxxApiModel())
 * @param {{ routeName: string, param?: string, listed?: boolean|(() => boolean) }} options - The route of a record, its id parameter, and whether it is shown from its list when its query carries no context
 * @returns {Object}
 */
export function useRecordContext(api, { routeName, param = 'id', listed = false }) {
    const route = useRoute();
    const router = useRouter();

    const context = computed(() => {
        if (!route.query.ctx) {
            return toValue(listed) ? {} : null;
        }

        try {
            return JSON.parse(String(route.query.ctx));
        } catch {
            return null;
        }
    });

    const { previous, next, status, error } = useApiSiblings(
        api.modelName,
        () => (context.value ? (route.params[param] ?? null) : null),
        () => ({ filter: context.value?.f ?? undefined, orderBy: context.value?.o ?? undefined }),
        { api }
    );

    /** @param {number|string} id */
    const go = (id) =>
        router.replace({ name: routeName, params: { ...route.params, [param]: id }, query: route.query });

    return { previous, next, status, error, inList: computed(() => context.value !== null), go };
}
