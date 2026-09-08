/**
 * A list read as tiles: the data iterator, sized for a grid.
 *
 * @param {string|object} model - Model name or an api model (useXxxApiModel())
 * @param {Object} options - Configuration options
 * @param {Array<string>} options.fields - Fields shown by a tile
 * @param {Array<string>} options.additionalFields - Fields to read without showing them
 * @param {number} options.pageSize - Default items per page (default: 24, remembered)
 * @param {Array} options.availablePageSizes - Available page sizes (default: [12, 24, 48, 96])
 * @returns {Object} - The data iterator
 */
export declare function useDataGrid(model: string | object, options?: {
    fields: Array<string>;
    additionalFields: Array<string>;
    pageSize: number;
    availablePageSizes: any[];
}): any;
//# sourceMappingURL=data-grid.d.ts.map