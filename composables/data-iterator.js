/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { ref, computed, toValue, watch, nextTick, getCurrentScope, onScopeDispose } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApiModel } from './api.js';
import { formatOrderBy, parseOrderBy } from '../utils/order-by.js';
import { usePageSize } from './page-size.js';
import { useSelection } from './selection.js';
import { useSortable } from './sortable.js';
import { useMetadataStore } from '../stores/metadata.js';

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
 * @param {HTMLElement|Window|import('vue').Ref|Function} options.scrollTarget - Element that scrolls the list, whose
 *   position is kept in the URL (`sl`) and restored on entry; nothing is kept when absent
 * @param {string} options.datasetPrefix - Where the `/dataset/*` routes answer, when they are not at the root
 * @param {string} options.pageSizeKey - Where the page size is remembered, nowhere when absent
 * @param {boolean|Function|import('vue').Ref<boolean>} options.enabled - Whether the list reads at all; the first
 *   page waits for it, so a screen still resolving its fields or filter does not read the list more than once
 *   (default: true)
 * @returns {Object} - DataIterator state and methods
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

    const initialPage = route.query.p ? parseInt(route.query.p, 10) : 1;
    const currentPage = ref(initialPage > 0 ? initialPage : 1);

    // An appended list entered at page n reads pages 1 to n in one request,
    // so the rows the scroll position points at are there.
    let restorePages = config.append ? currentPage.value : 1;

    const initialScroll = route.query.sl ? parseInt(route.query.sl, 10) : 0;
    let restoreScroll = config.scrollTarget && initialScroll > 0 ? initialScroll : null;

    const pageSize = usePageSize(route.query.s, config.availablePageSizes, config.pageSize, config.pageSizeKey);

    const customFilter = ref(null);

    const search = ref(typeof route.query.q === 'string' ? route.query.q : '');
    const appliedSearch = ref(search.value.trim());

    const filter = computed(() => {
        const restrictiveFilters = typeof config.filter === 'function' ? config.filter() || [] : config.filter || [];
        const extraRules = [
            customFilter.value,
            appliedSearch.value ? [config.searchField, 'search_fuzzy', appliedSearch.value] : null,
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

    const initialOrderBy = parseOrderBy(route.query.order_by) ?? config.defaultOrderBy ?? null;
    const orderBy = ref(initialOrderBy);

    /**
     * Fetch items from API with current filters, pagination, and sorting
     */
    const enabled = () => toValue(config.enabled) !== false;

    // Only the latest read lands: an earlier one answering last would put back
    // the rows of a filter or a field list the screen has already left.
    let latest = 0;

    // What the last read asked for: a screen settles its fields as its metadata
    // arrives, and the read that goes out then already carries them.
    let readFields = null;

    const fetchItems = async (append = false) => {
        if (!enabled()) {
            return;
        }

        const run = ++latest;
        const pages = append ? 1 : restorePages;

        restorePages = 1;
        readFields = fields.value.join(',');

        try {
            loading.value = true;
            error.value = null;

            const result = await service.list({
                page: pages > 1 ? 1 : currentPage.value,
                size: pageSize.value * pages,
                fields: fields.value,
                filter: filter.value,
                orderBy: orderBy.value,
            });

            if (run !== latest) {
                return;
            }

            items.value = append ? [...items.value, ...result.data.items] : result.data.items;
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
     * Toggle sort direction for a field
     * @param {string} field - Field to sort by
     */
    const toggleSort = (field) => {
        if (!field) return;

        if (config.orderable === false) return;

        const currentSort = orderBy.value?.[0];

        if (currentSort) {
            const [currentField, currentDirection = 'asc'] = currentSort.split(':');

            if (currentField === field) {
                if (currentDirection === 'asc') {
                    orderBy.value = [`${field}:desc`];
                } else {
                    orderBy.value = null;
                }
            } else {
                orderBy.value = [`${field}:asc`];
            }
        } else {
            orderBy.value = [`${field}:asc`];
        }
    };

    /**
     * Get current sort state for a field
     * @param {string} field - Field name
     * @returns {'asc' | 'desc' | null}
     */
    const getSortDirection = (field) => {
        if (!orderBy.value) return null;
        const sortItem = orderBy.value.find((item) => item.startsWith(`${field}:`));
        if (!sortItem) return null;
        const [, direction = 'asc'] = sortItem.split(':');
        return direction;
    };

    /**
     * Refresh data from server
     */
    const refresh = () => {
        restorePages = 1;

        if (config.append) {
            currentPage.value = 1;
        }

        return fetchItems();
    };

    /**
     * Reset pagination to first page
     */
    const resetPagination = () => {
        currentPage.value = 1;
    };

    const hasMore = computed(() => items.value.length < total.value);

    /**
     * Load the next page and keep the items already loaded
     * @returns {Promise<void>}
     */
    const loadMore = async () => {
        if (loading.value || !hasMore.value) {
            return;
        }

        currentPage.value += 1;

        await fetchItems(true);
    };

    /**
     * Read again from the first page, whatever page is loaded
     */
    const reload = () => {
        restorePages = 1;

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
     * @returns {Promise<void>}
     */
    const resequenceWithState = async (ids) => {
        try {
            loading.value = true;

            await resequence(ids);
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
    // rules it was already showing.
    watch(
        () => JSON.stringify(filter.value ?? null),
        () => reload()
    );

    watch(
        () => JSON.stringify(customFilter.value ?? null),
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
            writeQuery({ order_by: formatOrderBy(newOrderBy) });

            reload();
        },
        { deep: true }
    );

    // Watch page size changes - reset to first page and update URL
    watch(pageSize, (newSize) => {
        resetPagination();

        writeQuery({ s: newSize });
    });

    // Watch page changes - update URL and fetch
    watch(currentPage, (newPage) => {
        writeQuery({ p: newPage > 1 ? newPage : null });

        if (!config.append) {
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
        search,

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
