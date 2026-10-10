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
export type DataGroup = {
    /**
     * - Stable across the pages of the axis: `value:<value>`, `id:<id>` or `empty`
     */
    key: string;
    label: string;
    color: any;
    /**
     * - The value of the field its rows hold, null for the group of the rows with none
     */
    value: any;
    /**
     * - The record of a relation it stands for, read with the fields of the
     * axis
     */
    record: Record<string, any> | null;
    /**
     * - The rule that delimits it
     */
    predicate: any[];
    /**
     * - The filter its rows are read with: the one of the list, its rule and the one the list adds
     */
    filter: any;
    /**
     * - Whether it holds the rows with no value
     */
    isEmptyBucket: boolean;
    items: Array<any>;
    total: number;
    /**
     * - The last page its rows hold
     */
    page: number;
    totalPages: number;
    /**
     * - Whether rows remain after those it holds
     */
    hasMore: boolean;
    loading: boolean;
    error: any;
    /**
     * - Show a page of its rows
     */
    setPage: (page: number) => Promise<void>;
    /**
     * - Add the next page to its rows
     */
    loadMore: () => Promise<void>;
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
 *   of the URL, which says only those that moved away from it. A view also holds the grouping of the list
 *   (`group_by`) and, for a list whose users choose its columns, those columns (`display_fields`). `state` names what
 *   a view holds besides, by field of the view: applied on opening unless the URL says it under its `key`, applied and
 *   saved with the view by `useCustomViews`. A screen that keeps `group_by` in `state` keeps the grouping its own
 * @param {string} options.groupBy - The field the rows are grouped by when nothing else says it, none for a flat list:
 *   a field with choices, a boolean or a single relation. The grouping is kept in the URL as `g` when it is not this
 *   one, `none` for a flat list then. Each group reads its own rows, a page at a time
 * @param {number} options.rowLimit - The rows of a page of a group (default: 20)
 * @param {Array<string>} options.groupFields - More fields read on the records of an axis made of a relation
 * @param {(group: DataGroup) => any} options.groupFilter - A rule added to the filter of one group, from what its axis
 *   says of it (its `value`, its `record`), null for none
 * @param {'last'|'first'|'none'|((field: string) => 'last'|'first'|'none')} options.emptyGroup - Where the group of
 *   the rows with no value stands (default: last), or what says it for the field grouped by; a required field has none
 * @param {Record<string, any>|Function|import('vue').Ref<Record<string, any>>} options.relationScopes - The rule
 *   narrowing the records an axis made of a relation shows, by field
 * @param {(field: string, value: any) => any} options.colorOf - The color of the group of a value on an axis of
 *   choices, null to leave it to the screen
 * @param {import('vue').ShallowRef<any>} options.layout - Where the column layout of the list is held, which
 *   `useColumnLayout` fills when it is given the list: a view then saves and shows its columns
 * @returns {Object} - DataIterator state and methods
 */
/**
 * @typedef {Object} ViewStateField
 * @property {() => any} get - What the list holds now
 * @property {(value: any) => void} set - Hold what a view says, null when it says nothing
 * @property {string} [key] - The URL key the application keeps it under
 */
/**
 * A group of a grouped list: what its axis says of it, its rows and their pages.
 *
 * @typedef {Object} DataGroup
 * @property {string} key - Stable across the pages of the axis: `value:<value>`, `id:<id>` or `empty`
 * @property {string} label
 * @property {any} color
 * @property {any} value - The value of the field its rows hold, null for the group of the rows with none
 * @property {Record<string, any>|null} record - The record of a relation it stands for, read with the fields of the
 *   axis
 * @property {Array} predicate - The rule that delimits it
 * @property {any} filter - The filter its rows are read with: the one of the list, its rule and the one the list adds
 * @property {boolean} isEmptyBucket - Whether it holds the rows with no value
 * @property {Array<Object>} items
 * @property {number} total
 * @property {number} page - The last page its rows hold
 * @property {number} totalPages
 * @property {boolean} hasMore - Whether rows remain after those it holds
 * @property {boolean} loading
 * @property {any} error
 * @property {(page: number) => Promise<void>} setPage - Show a page of its rows
 * @property {() => Promise<void>} loadMore - Add the next page to its rows
 */
export declare function useDataIterator(model: any, options?: {}): {
    items: import("vue").WritableComputedRef<any[], any[]>;
    total: import("vue").WritableComputedRef<any, any>;
    loading: import("vue").ComputedRef<boolean>;
    loaded: import("vue").Ref<boolean, boolean>;
    error: import("vue").ComputedRef<null>;
    fields: import("vue").ComputedRef<any[]>;
    byId: (id: string | number) => Record<string, any> | null;
    upsertLocal: (item: any, { prepend }?: {
        prepend?: boolean;
    }) => boolean;
    writing: <T>(write: () => Promise<T>) => Promise<T>;
    currentPage: import("vue").Ref<number, number>;
    pageSize: import("vue").Ref<number, number>;
    availablePageSizes: number[];
    totalPages: import("vue").ComputedRef<number>;
    hasMore: import("vue").ComputedRef<boolean>;
    loadMore: () => Promise<void>;
    filter: import("vue").Ref<null, null>;
    combinedFilter: import("vue").ComputedRef<any>;
    rowsFilter: import("vue").ComputedRef<any>;
    expression: import("vue").Ref<any, any>;
    search: import("vue").Ref<string, string>;
    view: import("vue").Ref<number | null, number | null>;
    viewExpression: import("vue").Ref<undefined, undefined>;
    viewState: any;
    applyView: (shown: Record<string, any> | null, query?: Record<string, any>) => void;
    opened: Readonly<import("vue").Ref<boolean, boolean>>;
    quick: Record<string, any>;
    quickFilters: any;
    defaultOrderBy: any;
    orderBy: any;
    toggleSort: (field: string) => void;
    getSortDirection: (field: string) => 'asc' | 'desc' | null;
    groupBy: import("vue").Ref<string | null, string | null>;
    defaultGroupBy: any;
    groupByOf: (said: string | null | undefined) => string | null;
    groups: import("vue").ComputedRef<never[]>;
    groupPage: import("vue").ComputedRef<number>;
    groupTotalPages: import("vue").ComputedRef<number>;
    setGroupPage: (page: number) => Promise<void>;
    groupableFields: import("vue").ComputedRef<any[]>;
    canMoveToGroup: import("vue").ComputedRef<boolean>;
    canMoveGroups: import("vue").ComputedRef<boolean>;
    moveTo: (item: any, group: DataGroup, index?: number | null) => Promise<void>;
    moveGroup: (group: DataGroup, index: number) => Promise<void>;
    layout: any;
    displayFields: import("vue").ComputedRef<any>;
    isSortable: import("vue").ComputedRef<any>;
    resequence: (ids: Array<number>, options?: {
        groupField?: string;
        groupValue?: any;
    }) => Promise<void>;
    isSelectionEnabled: any;
    selection: any;
    refresh: () => any;
    resetPagination: () => void;
    exportData: (format?: string) => Promise<Blob>;
    importData: (file: File, options?: {
        delimiter?: string;
    }) => Promise<any>;
};
//# sourceMappingURL=data-iterator.d.ts.map