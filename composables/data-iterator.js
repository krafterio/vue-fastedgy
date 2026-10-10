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
 * @param {string} options.datasetPrefix - Where the `/dataset/*` routes answer, when they are not at the root
 * @param {string} options.pageSizeKey - Where the page size is remembered, nowhere when absent
 * @param {boolean} options.url - Keep the state of the list in the URL (default: true); false holds it in memory, for
 *   a list drawn inside a screen whose URL says something else (a tab of a record shown over another list)
 * @param {boolean|Function|import('vue').Ref<boolean>} options.enabled - Whether the list reads at all; the first
 *   page waits for it, so a screen still resolving its fields or filter does not read the list more than once
 *   (default: true)
 * @param {Array<import('./quick-filter.js').QuickFilter|object>} options.quickFilters - Values shown by the controls of
 *   the screen (their definitions, or the components `defineQuickFilter` makes), held in `quick`, kept in the URL as
 *   `qf` when away from their default, their rules combined with the rest of the filter
 * @param {boolean|{ scope?: string, prefix?: string, state?: Record<string, ViewStateField> }} options.views - Open on
 *   the custom view the list starts from, applied before the first page: the one a link names (`cv`), else, for a URL
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

    // A list drawn inside another screen leaves the URL to that screen.
    const urlQuery = () => (config.url === false ? {} : route.query);
    const entry = urlQuery();

    const items = ref([]);
    const total = ref(0);
    const loading = ref(false);
    const loaded = ref(false);
    const error = ref(null);

    // Several watchers answer to the same change (a search resets the page),
    // and each replace would start from a query the previous one has not
    // landed yet: their keys are written together.
    let pendingQuery = null;

    const writeQuery = (patch) => {
        if (config.url === false) {
            return;
        }

        if (!pendingQuery) {
            pendingQuery = {};

            queueMicrotask(() => {
                const query = { ...route.query };

                for (const [key, value] of Object.entries(pendingQuery)) {
                    if (value == null || value === '') {
                        delete query[key];
                    } else {
                        query[key] = String(value);
                    }
                }

                pendingQuery = null;
                void router.replace({ query });
            });
        }

        Object.assign(pendingQuery, patch);
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

    const filter = computed(() => {
        const restrictiveFilters = typeof config.filter === 'function' ? config.filter() || [] : config.filter || [];
        const extraRules = [
            customFilter.value,
            expression.value,
            ...quickFilters.map((one) => one.filter(quick[one.name])),
            appliedSearch.value ? searchRule(appliedSearch.value) : null,
        ].filter(Boolean);

        if (extraRules.length === 0) {
            return restrictiveFilters.length > 0 ? restrictiveFilters : null;
        }

        const restrictiveRules = restrictiveFilters.every((rule) => Array.isArray(rule))
            ? restrictiveFilters
            : [restrictiveFilters];

        return [...restrictiveRules, ...extraRules];
    });

    const metadata = metadataStore.getMetadata(modelName);
    const {
        isSortable,
        sortableField,
        resequence,
        ready: sortableReady,
    } = useSortable(modelName, metadata, config.sortable, { prefix: config.datasetPrefix });

    const fields = computed(() => {
        let baseFields = [];

        const resolver = config.fieldsResolver ?? config.fields;

        if (typeof resolver === 'function') {
            baseFields = resolver();
        } else if (Array.isArray(resolver)) {
            baseFields = resolver;
        }

        const allFields = ['id', ...baseFields];

        if (isSortable.value && sortableField.value && !allFields.includes(sortableField.value)) {
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
    const opening =
        config.views && (linkedView !== null || !entered)
            ? useOpeningView(modelName, {
                  scope: config.views.scope,
                  prefix: config.views.prefix ?? config.prefix,
                  id: linkedView,
              })
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

        readFields = fields.value.join(',');

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
     * Refresh data from server: the rows shown, every page an appended list holds read again at once
     */
    const refresh = () => fetchItems('held');

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

            void fetchItems();

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
     * @returns {Promise<Object>} - Import result with statistics
     */
    const importData = async (file) => {
        try {
            const response = await service.import(file);
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
    watch(
        () => JSON.stringify(filter.value ?? null),
        () => reload()
    );

    // A column added or removed is another read; the fields the read already
    // carried are not.
    watch(
        () => fields.value.join(','),
        (next) => {
            if (latest > 0 && next !== readFields) {
                void refresh();
            }
        }
    );

    // Watch sorting changes - update URL and fetch
    watch(
        orderBy,
        (newOrderBy) => {
            const byDefault = JSON.stringify(newOrderBy ?? null) === JSON.stringify(config.defaultOrderBy ?? null);

            writeQuery({ order_by: byDefault ? null : formatOrderBy(newOrderBy) });

            reload();
        },
        { deep: true }
    );

    // Watch page size changes - read again from the first page, already there or not, and update URL
    watch(pageSize, (newSize) => {
        reload();

        writeQuery({ s: newSize });
    });

    // Watch page changes - update URL and fetch
    watch(currentPage, (newPage) => {
        writeQuery({ p: newPage > 1 ? newPage : null });

        const byMore = newPage === pageOfMore;

        pageOfMore = null;

        if (!config.append && !byMore) {
            void fetchItems();
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
        });
    }

    // Initial fetch, held back until the caller says the list is ready
    void sortableReady.then(() => fetchItems());

    watch(enabled, (on) => {
        if (on) {
            void sortableReady.then(() => fetchItems());
        }
    });

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
