/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { ref, toValue } from 'vue';
import { useApiModel } from './api.js';

/**
 * The records a field offers to choose from: a page at a time, searched, and
 * the one already chosen read back by its id.
 *
 * A picker shows a handful of fields and holds an id: this reads exactly those
 * fields, continues the list as it is scrolled, and resolves the value it was
 * given so the closed field has something to show.
 *
 * @param {string|object} model - Model name: metadata 'name' or 'api_name', or an api model
 * @param {{fields?: string[], filter?: Array|function(): Array, limit?: number,
 *          minSearchLength?: number, searchFilter?: function(string): Array,
 *          params?: object, query?: object|function(): object}} [options]
 *
 * @returns {{items: import("vue").Ref<Array>, loading: import("vue").Ref<boolean>,
 *            hasMore: import("vue").Ref<boolean>, total: import("vue").Ref<number>,
 *            search: (function(string): Promise<void>), loadMore: (function(): Promise<void>),
 *            refresh: (function(): Promise<void>), resolve: (function(string|number): Promise<any>)}}
 *
 * @example
 * const { items, search, loadMore } = useApiOptions('plant_template', {
 *     fields: ['name', 'image'],
 *     searchFilter: (text) => ['name', 'icontains', text],
 * });
 */
export function useApiOptions(model, options = {}) {
    const {
        fields = [],
        filter = null,
        limit = 50,
        minSearchLength = 1,
        searchFilter = null,
        params = {},
        query = {},
    } = options;

    const reader = typeof model === 'string' ? useApiModel(model, params) : model;

    const items = ref([]);
    const loading = ref(false);
    const hasMore = ref(true);
    const total = ref(0);

    let offset = 0;
    let text = '';

    const read = () => ['id', ...fields].filter((field, index, all) => all.indexOf(field) === index);

    const restrictive = () => (typeof filter === 'function' ? filter() : toValue(filter));

    const rules = () => {
        const restricted = restrictive();
        const searched = text && searchFilter ? searchFilter(text) : null;

        if (restricted && searched) {
            return ['&', [restricted, searched]];
        }

        return searched || restricted || null;
    };

    async function load(append) {
        loading.value = true;

        try {
            const response = await reader.list({
                ...(typeof query === 'function' ? query() : toValue(query)),
                fields: read(),
                filter: rules(),
                limit,
                offset: append ? offset : 0,
            });

            const page = response?.data ?? {};
            const read_items = page.items ?? [];

            items.value = append ? [...items.value, ...read_items] : read_items;
            total.value = page.total ?? items.value.length;
            offset = items.value.length;
            hasMore.value = read_items.length === limit && items.value.length < total.value;
        } catch {
            if (!append) {
                items.value = [];
            }

            hasMore.value = false;
        } finally {
            loading.value = false;
        }
    }

    return {
        items,
        loading,
        hasMore,
        total,

        /**
         * Read the first page of what the text matches.
         *
         * A text shorter than the length the caller asked for is left alone: a
         * single letter is a keystroke, not a search.
         *
         * @param {string} [value]
         * @returns {Promise<void>}
         */
        search: async (value = '') => {
            if (value && value.length < minSearchLength) {
                return;
            }

            text = value;

            await load(false);
        },

        /**
         * @returns {Promise<void>}
         */
        loadMore: async () => {
            if (loading.value || !hasMore.value) {
                return;
            }

            await load(true);
        },

        /**
         * @returns {Promise<void>}
         */
        refresh: () => load(false),

        /**
         * Read one record back, for a field holding an id and nothing else.
         *
         * @param {string|number} id
         * @returns {Promise<any>} - The record, or null when it cannot be read
         */
        resolve: async (id) => {
            try {
                const response = await reader.get(id, { fields: read() });

                return response?.data ?? null;
            } catch {
                return null;
            }
        },
    };
}
