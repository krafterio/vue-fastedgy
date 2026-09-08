/**
 * A list read as columns: the data iterator, plus the columns it reads.
 *
 * @param {string|object} model - Model name or an api model (useXxxApiModel())
 * @param {Object} options - Configuration options
 * @param {Array} options.columns - Column definitions [{key, label, width, sortable, type}, ...]
 * @param {Array} options.additionalFields - Fields to read without showing them
 * @param {number} options.pageSize - Default items per page (default: 100, remembered)
 * @param {Array} options.availablePageSizes - Available page sizes (default: [25, 50, 100, 150, 200])
 * @param {Array<string>} options.defaultOrderBy - Default sort ['field:asc', 'field2:desc']
 * @param {Array<string>} options.exportFields - Fields to export (default: the columns)
 * @param {Array|Function} options.filter - Restrictive filters to always apply
 * @param {string} options.prefix - Prefix for the API
 * @param {Object} options.headers - Custom headers for API requests
 * @param {boolean} options.orderable - Enable column sorting (default: true)
 * @param {boolean} options.enableSelection - Enable row selection (default: false)
 * @returns {Object} - The data iterator, with `columns`
 */
export declare function useDataTable(model: string | object, options?: {
    columns: any[];
    additionalFields: any[];
    pageSize: number;
    availablePageSizes: any[];
    defaultOrderBy: Array<string>;
    exportFields: Array<string>;
    filter: any[] | Function;
    prefix: string;
    headers: any;
    orderable: boolean;
    enableSelection: boolean;
}): any;
//# sourceMappingURL=data-table.d.ts.map