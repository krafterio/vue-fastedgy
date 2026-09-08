/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { useDataIterator } from './data-iterator.js';

/**
 * A list read as tiles: the data iterator, sized for a grid.
 *
 * @param {string|Object} model - Model name or an api model (useXxxApiModel())
 * @param {Object} options - Configuration options
 * @param {Array<string>} options.fields - Fields shown by a tile
 * @param {Array<string>} options.additionalFields - Fields to read without showing them
 * @param {number} options.pageSize - Default items per page (default: 24, remembered)
 * @param {Array} options.availablePageSizes - Available page sizes (default: [12, 24, 48, 96])
 * @returns {Object} - The data iterator
 */
export function useDataGrid(model, options = {}) {
    return useDataIterator(model, {
        ...options,
        fieldsResolver: () => [...(options.fields || []), ...(options.additionalFields || [])],
        pageSize: options.pageSize || 24,
        availablePageSizes: options.availablePageSizes || [12, 24, 48, 96],
        pageSizeKey: options.pageSizeKey || 'datagrid-page-size',
    });
}
