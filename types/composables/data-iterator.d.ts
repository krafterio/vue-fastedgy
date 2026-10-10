export type ViewStateField = {
    /**
     * - What the list holds now
     */
    get: () => any;
    /**
     * - Hold what a view says, null when it says nothing
     */
    set: (value: any) => void;
    /**
     * - The URL key the application keeps it under
     */
    key?: string;
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
 * @param {Array<string>|Function|import('vue').Ref<Array<string>>} options.searchFields - Fields the `search` text is
 *   looked for in instead, a record matching on any of them (`icontains`); a getter or a ref is read again as it
 *   changes
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
export declare function useDataIterator(model: any, options?: {}): {
    items: import("vue").Ref<never[], never[]>;
    total: import("vue").Ref<number, number>;
    loading: import("vue").Ref<boolean, boolean>;
    loaded: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<null, null>;
    currentPage: import("vue").Ref<number, number>;
    pageSize: import("vue").Ref<number, number>;
    availablePageSizes: number[];
    totalPages: import("vue").ComputedRef<number>;
    hasMore: import("vue").ComputedRef<boolean>;
    loadMore: () => Promise<void>;
    filter: import("vue").Ref<null, null>;
    combinedFilter: import("vue").ComputedRef<any>;
    expression: import("vue").Ref<any, any>;
    search: import("vue").Ref<string, string>;
    view: import("vue").Ref<number | null, number | null>;
    viewExpression: import("vue").Ref<undefined, undefined>;
    viewState: any;
    opened: Readonly<import("vue").Ref<boolean, boolean>>;
    quick: Record<string, any>;
    quickFilters: any;
    defaultOrderBy: any;
    orderBy: any;
    toggleSort: (field: string) => void;
    getSortDirection: (field: string) => 'asc' | 'desc' | null;
    isSortable: import("vue").ComputedRef<any>;
    resequence: (ids: Array<number>, options?: {
        groupField?: string;
        groupValue?: any;
    }) => Promise<void>;
    isSelectionEnabled: any;
    selection: any;
    refresh: () => Promise<void>;
    resetPagination: () => void;
    exportData: (format?: string) => Promise<Blob>;
    importData: (file: File, options?: {
        delimiter?: string;
    }) => Promise<any>;
};
//# sourceMappingURL=data-iterator.d.ts.map