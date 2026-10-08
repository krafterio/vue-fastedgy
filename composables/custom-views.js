/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { computed, ref } from 'vue';
import { useApiModel } from './api.js';
import { useAuthStore } from '../stores/auth.js';
import { sameExpression } from '../utils/query-expression.js';

const VIEW_FIELDS = 'id,name,model,scope,user,filters,order_by,group_by,display_fields,sequence,is_default,editable';

/**
 * @typedef {Object} CustomView
 * @property {number} id
 * @property {string} name
 * @property {string} model
 * @property {string} scope
 * @property {{ id: number }|null} user
 * @property {any} filters
 * @property {Array<string>|null} order_by
 * @property {string|null} group_by
 * @property {Array<any>|null} display_fields
 * @property {number} sequence
 * @property {boolean} is_default
 * @property {boolean} editable
 */

const sameOrder = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const listOf = (model, scope) => [
    ['model', '=', model],
    ['scope', '=', scope],
];

/**
 * The custom views of a list: read once the menu opens, applied to the list,
 * saved from what it shows.
 *
 * `list` is the data iterator of the list: a view reads its expression and its
 * order, and is applied back to them. The methods reject what the server
 * refuses; showing it is the interface's business.
 *
 * @param {string} model - The metadata name of the listed model
 * @param {{ scope?: string, prefix?: string, list?: any }} [options]
 * @returns {Object}
 */
export function useCustomViews(model, options = {}) {
    const { scope = '', prefix = '', list = null } = options;
    const api = useApiModel('custom_view', { prefix });
    const favorites = useApiModel('custom_view_favorite', { prefix });
    const authStore = useAuthStore();

    const items = ref(/** @type {Array<CustomView>} */ ([]));
    const favorite = ref(/** @type {{ id: number, view: number }|null} */ (null));
    const loading = ref(false);
    const loaded = ref(false);
    const error = ref(null);
    let reading = null;

    const read = async () => {
        loading.value = true;

        try {
            const [views, own] = await Promise.all([
                api.list({ size: 100, fields: VIEW_FIELDS, filter: listOf(model, scope) }),
                favorites.list({
                    size: 1,
                    fields: 'id,view',
                    filter: [
                        ['view.model', '=', model],
                        ['view.scope', '=', scope],
                    ],
                }),
            ]);
            const first = own.data.items[0];

            items.value = views.data.items;
            favorite.value = first ? { id: first.id, view: first.view?.id ?? first.view } : null;
            error.value = null;
            loaded.value = true;
        } catch (failure) {
            error.value = failure;

            throw failure;
        } finally {
            loading.value = false;
        }
    };

    const ensure = () => {
        if (loaded.value) {
            return Promise.resolve();
        }

        reading ??= read().finally(() => (reading = null));

        return reading;
    };

    const current = computed(() => items.value.find((view) => view.id === list?.view?.value) ?? null);

    const modified = computed(() => {
        const view = current.value;

        if (!view || !list) {
            return false;
        }

        return (
            !sameExpression(view.filters, list.expression.value) ||
            !sameOrder(view.order_by ?? list.defaultOrderBy ?? null, list.orderBy.value)
        );
    });

    const replaceItem = (view) => {
        items.value = items.value.map((item) => (item.id === view.id ? view : item));
    };

    const state = () => ({
        filters: list?.expression?.value ?? null,
        order_by: list?.orderBy?.value ?? null,
    });

    return {
        items,
        favorite: computed(() => favorite.value?.view ?? null),
        loading,
        loaded,
        error,
        current,
        modified,
        ensure,
        refresh: read,

        /**
         * Keep what the list shows as a new view, and make it the current one.
         * @param {{ name: string, shared?: boolean }} input
         * @returns {Promise<CustomView>}
         */
        create: async ({ name, shared = true }) => {
            // The default list is the scope the server writes: an empty one
            // would leave as null, which the field refuses.
            const response = await api.create(
                {
                    name,
                    model,
                    ...(scope ? { scope } : {}),
                    user: shared ? null : (authStore.user?.id ?? null),
                    ...state(),
                },
                { fields: VIEW_FIELDS }
            );

            items.value = [...items.value, response.data];

            if (list?.view) {
                list.view.value = response.data.id;
            }

            return response.data;
        },

        /**
         * Write what the list shows into a view.
         * @param {CustomView} view
         */
        save: async (view) => {
            replaceItem((await api.update(view.id, state(), { fields: VIEW_FIELDS })).data);
        },

        /**
         * @param {CustomView} view
         * @param {string} name
         */
        rename: async (view, name) => {
            replaceItem((await api.update(view.id, { name }, { fields: VIEW_FIELDS })).data);
        },

        /** @param {CustomView} view */
        remove: async (view) => {
            await api.delete(view.id);

            items.value = items.value.filter((item) => item.id !== view.id);

            if (favorite.value?.view === view.id) {
                favorite.value = null;
            }

            if (list?.view && list.view.value === view.id) {
                list.view.value = null;
            }
        },

        /**
         * Make a view the one the list opens on for everyone, or stop.
         * @param {CustomView} view
         * @param {boolean} on
         */
        setDefault: async (view, on) => {
            const saved = (await api.update(view.id, { is_default: on }, { fields: VIEW_FIELDS })).data;

            items.value = items.value.map((item) =>
                item.id === saved.id ? saved : on && item.is_default ? { ...item, is_default: false } : item
            );
        },

        /**
         * Make a view the one the list opens on for the current user, or stop.
         * @param {CustomView} view
         * @param {boolean} on
         */
        setFavorite: async (view, on) => {
            if (on) {
                const created = (await favorites.create({ view: view.id }, { fields: 'id,view' })).data;

                favorite.value = { id: created.id, view: view.id };

                return;
            }

            if (favorite.value?.view === view.id) {
                await favorites.delete(favorite.value.id);

                favorite.value = null;
            }
        },

        /**
         * Show a view: its expression, its order (the list's own when it has
         * none) and itself as the current view. The search stays.
         * @param {CustomView} view
         */
        apply: (view) => {
            if (!list) {
                return;
            }

            list.expression.value = view.filters ?? null;
            list.orderBy.value = view.order_by ?? list.defaultOrderBy ?? null;
            list.view.value = view.id;
        },
    };
}

/**
 * The view a list opens on, read before its first page: the favorite of the
 * current user, else the one of everyone, else none. Skipped when the list
 * already says what it shows (a link, a reload).
 *
 * @param {string} model - The metadata name of the listed model
 * @param {{ scope?: string, prefix?: string, skip?: boolean|(() => boolean) }} [options]
 * @returns {{ ready: import('vue').Ref<boolean>, view: import('vue').Ref<CustomView|null>, promise: Promise<void> }}
 */
export function useOpeningView(model, options = {}) {
    const { scope = '', prefix = '', skip = false } = options;
    const api = useApiModel('custom_view', { prefix });
    const favorites = useApiModel('custom_view_favorite', { prefix });
    const ready = ref(false);
    const view = ref(/** @type {CustomView|null} */ (null));

    const promise = (async () => {
        try {
            if (typeof skip === 'function' ? skip() : skip) {
                return;
            }

            const [own, shared] = await Promise.all([
                favorites.list({
                    size: 1,
                    fields: `id,${VIEW_FIELDS.split(',')
                        .map((field) => `view.${field}`)
                        .join(',')}`,
                    filter: [
                        ['view.model', '=', model],
                        ['view.scope', '=', scope],
                    ],
                }),
                api.list({
                    size: 1,
                    fields: VIEW_FIELDS,
                    filter: [...listOf(model, scope), ['is_default', 'is true']],
                }),
            ]);

            view.value = own.data.items[0]?.view ?? shared.data.items[0] ?? null;
        } catch {
            view.value = null;
        } finally {
            ready.value = true;
        }
    })();

    return { ready, view, promise };
}
