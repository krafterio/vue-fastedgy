/**
 * Core composable for data iteration with server-side pagination, filters, and sorting
 * Used as base for DataTable and DataGrid
 *
 * @param {string|Object} model - Model name (e.g., 'retail_chains', 'tasks') or an api model (useXxxApiModel())
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
export function useDataIterator(model: string | any, options?: {
    fields: Array<string>;
    fieldsResolver: Function | any[];
    pageSize: number;
    availablePageSizes: any[];
    defaultOrderBy: Array<string>;
    exportFields: Array<string>;
    filter: any[] | Function;
    prefix: string;
    headers: any;
    sortable: boolean;
    orderable: boolean;
    enableSelection: boolean;
    append: boolean;
    pageSizeKey: string;
}): any;
//# sourceMappingURL=data-iterator.d.ts.map