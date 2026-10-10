/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { ref, reactive, readonly, computed, toValue, watch, nextTick, getCurrentScope, onScopeDispose } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApiModel } from './api.js';
import { formatOrderBy, orderByTerm, parseOrderBy } from '../utils/order-by.js';
import { usePageSize } from './page-size.js';
import { useSelection } from './selection.js';
import { useSortable } from './sortable.js';
import { useMetadataStore } from '../stores/metadata.js';
import { useOpeningView } from './custom-views.js';
import { quickFilterOf, readQuickFilters, writeQuickFilters } from './quick-filter.js';
import { sameExpression } from '../utils/query-expression.js';
import { bus } from './bus.js';
import { RESOURCES_STALE } from './realtime.js';

/**
 * Read the expression a URL carries, `null` when it carries none or one that does not read.
 *
 * @param {unknown} value
 * @returns {any}
 */
function readExpression(value) {
    if (typeof value !== 'string' || value === '') {
        return null;
    }

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function readId(value) {
    const id = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;

    return Number.isInteger(id) && id > 0 ? id : null;
}

// The keys of every list of a page go through one queue per router: two lists
// writing in the same tick would each replace a query the other has not landed.
const queues = new WeakMap();

/**
 * Write keys in the query of the current route, with those of every list of the
 * page written in the same tick, in one replace.
 *
 * @param {object} router
 * @param {{ query: Record<string, any> }} route
 * @param {Record<string, unknown>} patch - The keys to write, `null` or `''` removing one
 */
function queueQuery(router, route, patch) {
    let pending = queues.get(router);

    if (!pending) {
        pending = {};
        queues.set(router, pending);

        queueMicrotask(() => {
            queues.delete(router);

            const query = { ...route.query };

            for (const [key, value] of Object.entries(pending)) {
                if (value == null || value === '') {
                    delete query[key];
                } else {
                    query[key] = String(value);
                }
            }

            // A replace is a navigation even when it changes nothing, and it
            // cancels the one the screen has going on (to another workspace).
            if (JSON.stringify(query) !== JSON.stringify(route.query)) {
                void router.replace({ query });
            }
        });
    }

    Object.assign(pending, patch);
}

/**
 * Default configuration values for data iteration
 */
const DEFAULT_OPTIONS = {
    pageSize: 50,
    availablePageSizes: [25, 50, 100],
    prefix: '',
    headers: null,
    pageSizeKey: null,
    enableSelection: false,
    orderable: true,
    append: false,
    searchField: 'search_value',
    scrollTarget: null,
    url: true,
};

/**
 * Core composable for data iteration with server-side pagination, filters, and sorting
 * Used as base for DataTable and DataGrid
 *
 * @param {string|object} model - Model name (e.g., 'retail_chains', 'tasks') or an api model (useXxxApiModel())
 * @param {Object} options - Configuration options
 * @param {Array<string>} options.fields - Fields read by the caller (e.g. ['name', 'type.name'])
 * @param {Function|Array} options.fieldsResolver - Function that returns fields array or static array
 * @param {number} options.pageSize - Default items per page (overrides default: 50)
 * @param {Array} options.availablePageSizes - Available page sizes (overrides default: [25, 50, 100])
 * @param {Array<string>} options.defaultOrderBy - Default sort ['field:asc', 'field2:desc']
 * @param {Array<string>} options.exportFields - Fields to export
 * @param {Array|Function} options.filter - Restrictive filters to always apply
 * @param {string} options.prefix - Prefix for the API (default: "")
 * @param {Object} options.headers - Custom headers for API requests (default: null)
 * @param {boolean} options.sortable - Enable drag & drop sorting
 * @param {boolean} options.orderable - Enable column sorting (default: true)
 * @param {boolean} options.enableSelection - Enable row selection (default: false)
 * @param {boolean} options.append - Keep the loaded items and append the next pages (default: false)
 * @param {string} options.searchField - Fulltext field the `search` text is matched on (default: 'search_value')
 * @param {Array<string>} options.searchFields - Fields the `search` text is looked for in instead, a record matching
 *   on any of them (`icontains`)
 * @param {HTMLElement|Window|import('vue').Ref|Function} options.scrollTarget - Element that scrolls the list, whose
 *   position is kept in the URL (`sl`) and restored on entry; nothing is kept when absent
 * @param {string} options.datasetPrefix - Where the `/dataset/*` routes answer: by default where the api model does
 *   (its prefix, else `options.prefix`), `''` for the root
 * @param {string} options.pageSizeKey - Where the page size is remembered, nowhere when absent
 * @param {boolean|{ prefix?: string }} options.url - Keep the state of the list in the URL (default: true), its keys
 *   after `prefix` when one is given (`done_p`, `done_q`…, the keys of `views.state` included), so that two lists of
 *   one screen keep theirs apart; false holds it in memory, for a list drawn inside a screen whose URL says something
 *   else (a tab of a record shown over another list)
 * @param {boolean|Function|import('vue').Ref<boolean>} options.enabled - Whether the list reads at all; the first
 *   page waits for it, so a screen still resolving its fields or filter does not read the list more than once
 *   (default: true)
 * @param {Array<import('./quick-filter.js').QuickFilter|object>} options.quickFilters - Values shown by the controls of
 *   the screen (their definitions, or the components `defineQuickFilter` makes), held in `quick`, kept in the URL as
 *   `qf` when away from their default, their rules combined with the rest of the filter
 * @param {boolean|{ scope?: string, prefix?: string, state?: Record<string, ViewStateField> }} options.views - Open on
 *   the custom view the list starts from, applied before the first page, the views being read under `prefix`, else
 *   under the prefix of the api model, else under `options.prefix`: the one a link names (`cv`), else, for a URL
 *   saying nothing of the list, the favorite of the user, else the one of everyone. The filters of the view stay out
 *   of the URL, which says only those that moved away from it. `state` names what a view holds besides its filters
 *   and its order, by field of the view (`group_by`): applied on opening unless the URL says it under its `key`,
 *   applied and saved with the view by `useCustomViews`
 * @returns {Object} - DataIterator state and methods
 */
/**
 * @typedef {Object} ViewStateField
 * @property {() => any} get - What the list holds now
 * @property {(value: any) => void} set - Hold what a view says, null when it says nothing
 * @property {string} [key] - The URL key the application keeps it under
 */

export function useDataIterator(model, options = {}) {
    const config = { ...DEFAULT_OPTIONS, ...options };
    const modelName = typeof model === 'string' ? model : model.modelName;
    const service =
        typeof model === 'string'
            ? useApiModel(model, {
                  prefix: options.prefix || DEFAULT_OPTIONS.prefix,
                  headers: options.headers || DEFAULT_OPTIONS.headers,
              })
            : model;
    const metadataStore = useMetadataStore();
    const route = useRoute();
    const router = useRouter();

    // A list drawn inside another screen leaves the URL to that screen. Two
    // lists of one screen keep their keys apart, each after its own prefix.
    const urlPrefix = config.url !== null && typeof config.url === 'object' ? (config.url.prefix ?? '') : '';

    // The query of the route as this list reads it: its own keys, without their prefix.
    const urlQuery = () => {
        if (config.url === false) {
            return {};
        }

        if (!urlPrefix) {
            return route.query;
        }

        return Object.fromEntries(
            Object.entries(route.query)
                .filter(([key]) => key.startsWith(urlPrefix))
                .map(([key, value]) => [key.slice(urlPrefix.length), value])
        );
    };
    const entry = urlQuery();

    const items = ref([]);
    const total = ref(0);
    const loading = ref(false);
    const loaded = ref(false);
    const error = ref(null);

    // Several watchers answer to the same change (a search resets the page),
    // and each replace would start from a query the previous one has not
    // landed yet: their keys are written together, with those of the other
    // lists of the page.
    // While the list takes a whole state at once (a URL changed from outside, a
    // workspace switch), its watchers neither write the URL nor read: one read
    // follows. The URL changed from outside already says what the list holds.
    let settling = false;

    // The values each key was written with and the route has not shown yet: the
    // list knows its own writes when they land, late or not.
    const sent = new Map();

    const writeQuery = (patch) => {
        if (config.url === false || settling) {
            return;
        }

        const shown = urlQuery();

        for (const [key, value] of Object.entries(patch)) {
            const text = value == null || value === '' ? null : String(value);

            if (text !== (shown[key] ?? null)) {
                sent.set(key, [...(sent.get(key) ?? []), text]);
            }
        }

        queueQuery(
            router,
            route,
            Object.fromEntries(Object.entries(patch).map(([key, value]) => [urlPrefix + key, value]))
        );
    };

    const initialPage = entry.p ? parseInt(entry.p, 10) : 1;
    const currentPage = ref(initialPage > 0 ? initialPage : 1);

    // The first page the rows hold, the last one being the current page: in a
    // list that pages, the current one, until loadMore adds the next ones; in an
    // appended list, the first, so that a list entered at page n reads its pages
    // 1 to n in one request and the rows the scroll position points at are there.
    let firstHeld = config.append ? 1 : currentPage.value;

    const initialScroll = entry.sl ? parseInt(entry.sl, 10) : 0;
    let restoreScroll = config.scrollTarget && initialScroll > 0 ? initialScroll : null;

    const pageSize = usePageSize(entry.s, config.availablePageSizes, config.pageSize, config.pageSizeKey);

    const customFilter = ref(null);

    // What a query builder sets, kept in the URL as `f`, and the custom view the
    // list is on, as `cv`: a link opens the list it was copied from. The filters
    // of the view are its own to say (`undefined` while they are not read), so
    // `f` says only those that moved away from them.
    const expression = ref(readExpression(entry.f));
    const view = ref(readId(entry.cv));
    const viewExpression = ref(undefined);

    const quickFilters = (config.quickFilters ?? []).map(quickFilterOf);
    const quick = reactive(readQuickFilters(entry.qf, quickFilters));

    const search = ref(typeof entry.q === 'string' ? entry.q : '');
    const appliedSearch = ref(search.value.trim());

    const searchRule = (text) => {
        const fields = config.searchFields;

        if (!Array.isArray(fields) || fields.length === 0) {
            return [config.searchField, 'search_fuzzy', text];
        }

        const rules = fields.map((field) => [field, 'icontains', text]);

        return rules.length > 1 ? ['|', rules] : rules[0];
    };

    // What narrows the list beyond its restrictive filter: the filter the screen
    // sets, the expression, the quick filters and the search.
    const extraRules = computed(() =>
        [
            customFilter.value,
            expression.value,
            ...quickFilters.map((one) => one.filter(quick[one.name])),
            appliedSearch.value ? searchRule(appliedSearch.value) : null,
        ].filter(Boolean)
    );

    const filter = computed(() => {
        const restrictiveFilters = typeof config.filter === 'function' ? config.filter() || [] : config.filter || [];

        if (extraRules.value.length === 0) {
            return restrictiveFilters.length > 0 ? restrictiveFilters : null;
        }

        const restrictiveRules = restrictiveFilters.every((rule) => Array.isArray(rule))
            ? restrictiveFilters
            : [restrictiveFilters];

        return [...restrictiveRules, ...extraRules.value];
    });

    const metadata = metadataStore.getMetadata(modelName);
    const {
        isSortable: sortableModel,
        sortableField,
        resequence,
        readMetadata,
        ready: sortableReady,
    } = useSortable(modelName, metadata, config.sortable, {
        // The dataset routes answer where the model does, unless the screen says otherwise ('' for the root).
        prefix: config.datasetPrefix ?? service.prefix ?? config.prefix,
    });

    // A manual order only means something over the whole list: numbering the
    // rows a search or a filter leaves would mix their ranks with the others'.
    // The restrictive filter fixes the list, and does not count.
    const isSortable = computed(() => sortableModel.value && extraRules.value.length === 0);

    const fields = computed(() => {
        let baseFields = [];

        const resolver = config.fieldsResolver ?? config.fields;

        if (typeof resolver === 'function') {
            baseFields = resolver();
        } else if (Array.isArray(resolver)) {
            baseFields = resolver;
        }

        const allFields = ['id', ...baseFields];

        if (sortableModel.value && sortableField.value && !allFields.includes(sortableField.value)) {
            allFields.push(sortableField.value);
        }

        return [...new Set(allFields)];
    });

    const initialOrderBy = parseOrderBy(entry.order_by) ?? config.defaultOrderBy ?? null;
    const orderBy = ref(initialOrderBy);

    // A list keeping custom views reads its first page once, already on the
    // view it starts from: the one its link names when the link carries no
    // filter of its own, else the favorite when the URL says nothing of the
    // list. The watchers answering to the view run while the list is held back.
    const viewState = (typeof config.views === 'object' && config.views?.state) || {};
    const stateKeys = Object.values(viewState)
        .map((one) => one.key)
        .filter(Boolean);
    const linkedView = 'f' in entry ? null : view.value;
    const entered = ['p', 's', 'order_by', 'q', 'sl', 'f', 'cv', 'qf', ...stateKeys].some((key) => key in entry);
    // The views answer where the model does, unless the screen says otherwise.
    const viewsPrefix = config.views ? (config.views.prefix ?? service.prefix ?? config.prefix) : config.prefix;
    const opening =
        config.views && (linkedView !== null || !entered)
            ? useOpeningView(modelName, { scope: config.views.scope, prefix: viewsPrefix, id: linkedView })
            : null;
    const opened = ref(opening === null);

    void opening?.promise.then(async () => {
        const start = opening.view.value;

        if (start) {
            expression.value = start.filters ?? null;
            viewExpression.value = start.filters ?? null;
            view.value = start.id;

            if (!('order_by' in urlQuery())) {
                orderBy.value = start.order_by ?? config.defaultOrderBy ?? null;
            }

            for (const [name, one] of Object.entries(viewState)) {
                if (!(one.key && one.key in urlQuery())) {
                    one.set(start[name] ?? null);
                }
            }

            await nextTick();
        } else {
            view.value = null;
        }

        opened.value = true;
    });

    /**
     * Fetch items from API with current filters, pagination, and sorting
     */
    const enabled = () => toValue(config.enabled) !== false && opened.value;

    // Only the latest read lands: an earlier one answering last would put back
    // the rows of a filter or a field list the screen has already left.
    let latest = 0;

    // What the last read asked for: a screen settles its fields as its metadata
    // arrives, and the read that goes out then already carries them.
    let readFields = null;

    // Several pages read at once start from the first one, or say their offset
    // when a list that pages added some to the page it was on.
    const readWindow = (from, pages) =>
        from === 1 || pages === 1
            ? { page: pages > 1 ? 1 : from, size: pageSize.value * pages }
            : { offset: (from - 1) * pageSize.value, limit: pageSize.value * pages };

    /**
     * Read the rows: the current page (with the pages before it in an appended
     * list), the next page added to the rows (`more`), or again every page the
     * rows hold (`held`)
     *
     * @param {'page'|'more'|'held'} [mode]
     */
    const fetchItems = async (mode = 'page') => {
        if (!enabled()) {
            return;
        }

        const run = ++latest;

        if (mode === 'page' && !config.append) {
            firstHeld = currentPage.value;
        }

        const from = mode === 'more' ? currentPage.value : firstHeld;

        readFields = new Set(fields.value);

        try {
            loading.value = true;
            error.value = null;

            const result = await service.list({
                ...readWindow(from, currentPage.value - from + 1),
                fields: fields.value,
                filter: filter.value,
                orderBy: orderBy.value,
            });

            if (run !== latest) {
                return;
            }

            items.value = mode === 'more' ? [...items.value, ...result.data.items] : result.data.items;
            total.value = result.data.total;

            if (restoreScroll !== null) {
                const top = restoreScroll;

                restoreScroll = null;
                void nextTick(() => scrollElement()?.scrollTo({ top }));
            }
        } catch (err) {
            if (run === latest) {
                error.value = err;
            }
        } finally {
            if (run === latest) {
                loading.value = false;
                loaded.value = true;
            }
        }
    };

    // The watchers answering to one change of the screen (a view applied sets
    // its filters and its order at once) read once, after them all: the page,
    // which carries the new fields too, before the rows held.
    let queued = null;
    let queuedMode = null;

    const queueRead = (mode) => {
        if (queuedMode !== 'page') {
            queuedMode = mode;
        }

        queued ??= Promise.resolve().then(() => {
            const next = queuedMode;

            queued = null;
            queuedMode = null;

            return fetchItems(next);
        });

        return queued;
    };

    /**
     * Toggle sort direction for a field: ascending, descending, then back to the default order
     * @param {string} field - Field to sort by
     */
    const toggleSort = (field) => {
        if (!field) return;

        if (config.orderable === false) return;

        const current = orderByTerm(orderBy.value?.[0] ?? '');

        if (current.field !== field) {
            orderBy.value = [`${field}:asc`];
        } else if (current.direction !== 'desc') {
            orderBy.value = [`${field}:desc`];
        } else {
            const byDefault = config.defaultOrderBy ?? null;

            // A default order on this very column would leave the click without effect: it turns around instead.
            orderBy.value = orderByTerm(byDefault?.[0] ?? '').field === field ? [`${field}:asc`] : byDefault;
        }
    };

    /**
     * Get current sort state for a field, a term written without a direction being ascending
     * @param {string} field - Field name
     * @returns {'asc' | 'desc' | null}
     */
    const getSortDirection = (field) => {
        const term = (orderBy.value ?? []).map(orderByTerm).find((one) => one.field === field);

        return term ? /** @type {'asc' | 'desc'} */ (term.direction) : null;
    };

    /**
     * Refresh data from server: the rows shown, every page an appended list holds read again at once; nothing
     * while the list takes a whole state, which a read follows
     */
    const refresh = () => (settling ? Promise.resolve() : fetchItems('held'));

    /**
     * Reset pagination to first page
     */
    const resetPagination = () => {
        currentPage.value = 1;
    };

    const hasMore = computed(() => (firstHeld - 1) * pageSize.value + items.value.length < total.value);

    // The page loadMore moves to is its own to read, added to the rows: the
    // watcher of the page does not read it again in their place.
    let pageOfMore = null;

    /**
     * Load the next page and keep the items already loaded, whether the list appends or pages
     * @returns {Promise<void>}
     */
    const loadMore = async () => {
        if (loading.value || !hasMore.value) {
            return;
        }

        currentPage.value += 1;
        pageOfMore = currentPage.value;

        await fetchItems('more');
    };

    /**
     * Read again from the first page, whatever page is loaded
     */
    const reload = () => {
        if (config.append || currentPage.value === 1) {
            currentPage.value = 1;

            void queueRead('page');

            return;
        }

        resetPagination();
    };

    /**
     * Export data with current filters and sorting
     * @param {string} format - Export format: 'csv', 'xlsx', 'json'
     * @returns {Promise<Blob>}
     */
    const exportData = async (format = 'csv') => {
        const response = await service.export({
            fields: config.exportFields || fields.value,
            filter: filter.value,
            orderBy: orderBy.value,
            format,
        });

        return await response.blob();
    };

    /**
     * Import data from a file
     * @param {File} file - File to import (CSV, XLSX, ODS)
     * @param {{ delimiter?: string }} [options] - The column delimiter of a CSV, detected by the server when absent
     * @returns {Promise<Object>} - Import result with statistics
     */
    const importData = async (file, options = {}) => {
        try {
            const response = await service.import(file, options.delimiter ? { delimiter: options.delimiter } : {});
            const result = response.data;

            if (result.success > 0) {
                await refresh();
            }

            return result;
        } catch (err) {
            // A file the server read and refused row by row is a result, not a failure.
            if (err?.data?.detail?.error_details) {
                return err.data.detail;
            }

            throw err;
        }
    };

    /**
     * Resequence items, holding the loading state and reading the rows again
     * @param {Array<number>} ids - New order of item IDs
     * @param {{ groupField?: string, groupValue?: any }} [options] - The group the ids are moved to
     * @returns {Promise<void>}
     */
    const resequenceWithState = async (ids, options = {}) => {
        if (sortableModel.value && !isSortable.value) {
            console.warn('[useDataIterator] Resequencing waits for the list to be narrowed by nothing');

            await refresh();

            return;
        }

        try {
            loading.value = true;

            // The rows shown come after the pages before them: their ranks count from there.
            await resequence(ids, { ...options, sequenceOffset: (firstHeld - 1) * pageSize.value });
            await refresh();
        } finally {
            loading.value = false;
        }
    };

    // Selection
    const { isSelectionEnabled, selection } = useSelection({
        enabled: config.enableSelection,
        items,
        total,
    });

    // On what the rules say, not on the array that says it: the filter is built
    // again whenever anything it reads is recomputed, and a deep watcher takes
    // each of those for a change, so the screen read its whole list again for
    // rules it was already showing. The filter the screen sets is among them.
    // A selection made under other rules is not this list's: it is emptied.
    watch(
        () => JSON.stringify(filter.value ?? null),
        () => {
            selection.clear();

            if (!settling) {
                reload();
            }
        }
    );

    // A column added is another read; a column removed, or the fields the read
    // already carried, are not.
    watch(
        () => fields.value.join(','),
        () => {
            if (!settling && latest > 0 && fields.value.some((one) => !readFields?.has(one))) {
                void queueRead('held');
            }
        }
    );

    // Watch sorting changes - update URL and fetch
    watch(
        orderBy,
        (newOrderBy) => {
            if (settling) {
                return;
            }

            const byDefault = JSON.stringify(newOrderBy ?? null) === JSON.stringify(config.defaultOrderBy ?? null);

            writeQuery({ order_by: byDefault ? null : formatOrderBy(newOrderBy) });

            reload();
        },
        { deep: true }
    );

    // Watch page size changes - read again from the first page, already there or not, and update URL
    watch(pageSize, (newSize) => {
        if (settling) {
            return;
        }

        reload();

        writeQuery({ s: newSize });
    });

    // Watch page changes - update URL and fetch
    watch(currentPage, (newPage) => {
        if (settling) {
            return;
        }

        writeQuery({ p: newPage > 1 ? newPage : null });

        const byMore = newPage === pageOfMore;

        pageOfMore = null;

        if (!config.append && !byMore) {
            void queueRead('page');
        }
    });

    // Search - applied after a pause in the typing, kept in the URL as `q`
    let searchTimer = null;

    watch(search, (value) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            appliedSearch.value = (value ?? '').trim();
        }, 300);
    });

    watch(appliedSearch, (value) => writeQuery({ q: value }));

    // Nothing for a list on its view as the view says it, the expression once
    // it moves away from it, `null` written out for filters cleared off a view.
    const writtenExpression = () => {
        const current = expression.value ?? null;

        if (view.value === null) {
            return current ? JSON.stringify(current) : null;
        }

        if (viewExpression.value !== undefined && sameExpression(current, viewExpression.value)) {
            return null;
        }

        return JSON.stringify(current);
    };

    watch(
        () =>
            JSON.stringify([
                expression.value ?? null,
                view.value,
                viewExpression.value === undefined ? '?' : viewExpression.value,
            ]),
        () => writeQuery({ f: writtenExpression() })
    );

    watch(view, (id) => writeQuery({ cv: id }));

    watch(
        () => JSON.stringify(quickFilters.map((one) => quick[one.name] ?? null)),
        () => writeQuery({ qf: writeQuickFilters(quick, quickFilters) })
    );

    // What each followed key says of the list as it stands: the value it would be written with.
    const shownAs = {
        p: () => (currentPage.value > 1 ? String(currentPage.value) : null),
        s: () => String(pageSize.value),
        order_by: () =>
            JSON.stringify(orderBy.value ?? null) === JSON.stringify(config.defaultOrderBy ?? null)
                ? null
                : formatOrderBy(orderBy.value),
        q: () => appliedSearch.value || null,
        f: () => writtenExpression(),
        cv: () => (view.value === null ? null : String(view.value)),
        qf: () => writeQuickFilters(quick, quickFilters),
    };

    /**
     * Whether the URL moved under the list: a key saying something the list
     * neither holds nor wrote. A size the URL leaves out keeps the one chosen.
     *
     * @param {Record<string, any>} query
     * @returns {boolean}
     */
    const movedFromOutside = (query) => {
        let moved = false;

        for (const [key, current] of Object.entries(shownAs)) {
            const value = typeof query[key] === 'string' ? query[key] : null;
            const pending = sent.get(key) ?? [];
            const own = pending.indexOf(value);

            if (own >= 0) {
                sent.set(key, pending.slice(own + 1));
            } else if (value !== current() && !(key === 's' && value === null)) {
                moved = true;
            }
        }

        return moved;
    };

    /**
     * Hold what a URL changed from outside says (back, forward, a link followed
     * to the same screen), as a list entered on it would, then read once.
     */
    const followUrl = async () => {
        const query = urlQuery();

        if (!opened.value || !movedFromOutside(query)) {
            return;
        }

        sent.clear();
        settling = true;

        try {
            const page = Number.parseInt(query.p ?? '', 10);
            const size = Number.parseInt(query.s ?? '', 10);

            currentPage.value = page > 0 ? page : 1;

            if (config.availablePageSizes.includes(size)) {
                pageSize.value = size;
            }

            search.value = typeof query.q === 'string' ? query.q : '';
            appliedSearch.value = search.value.trim();
            Object.assign(quick, readQuickFilters(query.qf, quickFilters));

            const linked = readId(query.cv);

            if (linked !== view.value) {
                let named = null;

                if (linked !== null && config.views) {
                    const reading = useOpeningView(modelName, {
                        scope: config.views.scope,
                        prefix: viewsPrefix,
                        id: linked,
                    });

                    await reading.promise;
                    named = reading.view.value;

                    for (const [name, one] of Object.entries(viewState)) {
                        if (!(one.key && one.key in query)) {
                            one.set(named?.[name] ?? null);
                        }
                    }
                }

                view.value = config.views ? (named?.id ?? null) : linked;
                viewExpression.value = named ? (named.filters ?? null) : undefined;
            }

            expression.value =
                'f' in query ? readExpression(query.f) : view.value !== null ? (viewExpression.value ?? null) : null;
            orderBy.value = parseOrderBy(query.order_by) ?? config.defaultOrderBy ?? null;

            await nextTick();
        } finally {
            settling = false;
        }

        await fetchItems();
    };

    if (config.url !== false) {
        watch(
            () => JSON.stringify(Object.keys(shownAs).map((key) => urlQuery()[key] ?? null)),
            () => void followUrl()
        );
    }

    /**
     * Start over in the workspace switched to, as a list opened there at once:
     * its state back to the opening, the metadata of that workspace waited for
     * and what hangs on it resolved again, its opening view read there, then
     * one read. The rows of the other workspace go meanwhile.
     */
    const startOver = async () => {
        sent.clear();
        settling = true;
        ++latest;

        try {
            selection.clear();
            items.value = [];
            total.value = 0;
            loaded.value = false;
            currentPage.value = 1;
            firstHeld = 1;
            clearTimeout(searchTimer);
            search.value = '';
            appliedSearch.value = '';
            customFilter.value = null;
            Object.assign(quick, readQuickFilters(null, quickFilters));
            view.value = null;
            viewExpression.value = undefined;
            expression.value = null;
            orderBy.value = config.defaultOrderBy ?? null;

            await readMetadata(metadataStore.getMetadata(modelName));

            if (config.views) {
                const reading = useOpeningView(modelName, { scope: config.views.scope, prefix: viewsPrefix });

                await reading.promise;

                const start = reading.view.value;

                for (const [name, one] of Object.entries(viewState)) {
                    one.set(start?.[name] ?? null);
                }

                if (start) {
                    expression.value = start.filters ?? null;
                    viewExpression.value = start.filters ?? null;
                    view.value = start.id;
                    orderBy.value = start.order_by ?? config.defaultOrderBy ?? null;
                }
            }

            await nextTick();
        } finally {
            settling = false;
        }

        writeQuery({
            p: null,
            q: null,
            qf: null,
            sl: null,
            f: writtenExpression(),
            cv: view.value,
            order_by: shownAs.order_by(),
        });
        void nextTick(() => scrollElement()?.scrollTo?.({ top: 0 }));

        await fetchItems();
    };

    // The switch is the workspace store's: a list born after it began reads in
    // the new workspace already.
    const born = performance.now();

    const onSwitch = (event) => {
        if ((event?.detail?.since ?? Infinity) >= born) {
            void startOver();
        }
    };

    bus.addEventListener(RESOURCES_STALE, onSwitch);

    // Scroll position - kept in the URL as `sl`
    function scrollElement() {
        const target = toValue(config.scrollTarget);

        return target?.$el ?? target ?? null;
    }

    let scrollTimer = null;

    watch(
        scrollElement,
        (element, _previous, onCleanup) => {
            if (!element) {
                return;
            }

            const onScroll = () => {
                clearTimeout(scrollTimer);
                scrollTimer = setTimeout(() => {
                    const top = Math.round('scrollY' in element ? element.scrollY : element.scrollTop);

                    writeQuery({ sl: top > 0 ? top : null });
                }, 350);
            };

            element.addEventListener('scroll', onScroll, { passive: true });
            onCleanup(() => element.removeEventListener('scroll', onScroll));
        },
        { immediate: true }
    );

    if (getCurrentScope()) {
        onScopeDispose(() => {
            clearTimeout(searchTimer);
            clearTimeout(scrollTimer);
            bus.removeEventListener(RESOURCES_STALE, onSwitch);
        });
    }

    // Initial fetch, held back until the caller says the list is ready and its
    // metadata read: the list enabled while it waits for them reads once.
    let starting = null;

    const start = () =>
        (starting ??= sortableReady.then(() => {
            starting = null;

            return fetchItems();
        }));

    watch(
        enabled,
        (on) => {
            if (on) {
                void start();
            }
        },
        { immediate: true }
    );

    return {
        // Data
        items,
        total,
        loading,
        loaded,
        error,

        // Pagination
        currentPage,
        pageSize,
        availablePageSizes: config.availablePageSizes,
        totalPages: computed(() => Math.ceil(total.value / pageSize.value)),
        hasMore,
        loadMore,

        // Filter
        filter: customFilter,
        combinedFilter: filter,
        expression,
        search,
        view,
        viewExpression,
        viewState,
        opened: readonly(opened),
        quick,
        quickFilters: config.quickFilters ?? [],
        defaultOrderBy: config.defaultOrderBy ?? null,

        // Order by
        orderBy,
        toggleSort,
        getSortDirection,

        // Sortable
        isSortable,
        resequence: resequenceWithState,

        // Selection
        isSelectionEnabled,
        selection,

        // Methods
        refresh,
        resetPagination,
        exportData,
        importData,
    };
}
