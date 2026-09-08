/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { ref, computed, watch } from 'vue';
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
 * @param {string} options.pageSizeKey - Where the page size is remembered, nowhere when absent
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

    const initialPage = !config.append && route.query.p ? parseInt(route.query.p, 10) : 1;
    const currentPage = ref(initialPage > 0 ? initialPage : 1);

    const pageSize = usePageSize(route.query.s, config.availablePageSizes, config.pageSize, config.pageSizeKey);

    const customFilter = ref(null);

    const filter = computed(() => {
        const restrictiveFilters = typeof config.filter === 'function' ? config.filter() || [] : config.filter || [];
        const custom = customFilter.value;

        if (!custom) {
            return restrictiveFilters.length > 0 ? restrictiveFilters : null;
        }

        const restrictiveRules = restrictiveFilters.every((rule) => Array.isArray(rule))
            ? restrictiveFilters
            : [restrictiveFilters];

        return [...restrictiveRules, custom];
    });

    const metadata = metadataStore.getMetadata(modelName);
    const {
        isSortable,
        sortableField,
        resequence,
        ready: sortableReady,
    } = useSortable(modelName, metadata, config.sortable);

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
    const fetchItems = async (append = false) => {
        try {
            loading.value = true;
            error.value = null;

            const result = await service.list({
                page: currentPage.value,
                size: pageSize.value,
                fields: fields.value,
                filter: filter.value,
                orderBy: orderBy.value,
            });

            items.value = append ? [...items.value, ...result.data.items] : result.data.items;
            total.value = result.data.total;
        } catch (err) {
            error.value = err;
        } finally {
            loading.value = false;
            loaded.value = true;
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

    // Watch filter changes - reset to first page and fetch
    watch(filter, reload, { deep: true });

    // Watch custom filter changes - reset to first page and fetch
    watch(customFilter, reload, { deep: true });

    // Watch sorting changes - update URL and fetch
    watch(
        orderBy,
        (newOrderBy) => {
            const query = { ...route.query };
            const orderByString = formatOrderBy(newOrderBy);
            if (orderByString) {
                query.order_by = orderByString;
            } else {
                delete query.order_by;
            }
            void router.replace({ query });

            reload();
        },
        { deep: true }
    );

    // Watch page size changes - reset to first page and update URL
    watch(pageSize, (newSize) => {
        resetPagination();

        const query = { ...route.query };
        query.s = newSize.toString();
        void router.replace({ query });
    });

    // Watch page changes - update URL and fetch
    watch(currentPage, (newPage) => {
        if (config.append) {
            return;
        }

        const query = { ...route.query };
        if (newPage > 1) {
            query.p = newPage.toString();
        } else {
            delete query.p;
        }
        void router.replace({ query });

        void fetchItems();
    });

    // Initial fetch
    void sortableReady.then(() => fetchItems());

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
