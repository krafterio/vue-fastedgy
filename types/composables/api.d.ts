/**
 * List action with pagination and filters
 *
 * @param {string} modelName - Model name: metadata 'name' or 'api_name'
 * @param {{ page?: number, size?: number, fields?: string|string[], filter?: string|object, orderBy?: string|string[] }} query - Standardized query parameters
 * @param {{ prefix?: string, headers?: object }} params - Optional parameters
 * @returns {Promise<{data: {items: any[], total: number, limit: number, offset: number, total_pages: number}}>}
 */
export function listAction(modelName: string, query?: {
    page?: number;
    size?: number;
    fields?: string | string[];
    filter?: string | object;
    orderBy?: string | string[];
}, params?: {
    prefix?: string;
    headers?: object;
}): Promise<{
    data: {
        items: any[];
        total: number;
        limit: number;
        offset: number;
        total_pages: number;
    };
}>;
/**
 * Get action - retrieve a single item by ID
 *
 * @param {string} modelName - Model name: metadata 'name' or 'api_name'
 * @param {string|number} id - Item ID
 * @param {{ fields?: string|string[] }} options - Options for field selection
 * @param {{ prefix?: string, headers?: object }} params - Optional parameters
 * @returns {Promise<{data: any}>}
 */
export function getAction(modelName: string, id: string | number, options?: {
    fields?: string | string[];
}, params?: {
    prefix?: string;
    headers?: object;
}): Promise<{
    data: any;
}>;
/**
 * Create action - create a new item
 *
 * @param {string} modelName - Model name: metadata 'name' or 'api_name'
 * @param {object} payload - Data to create
 * @param {{ fields?: string|string[] }} options - Options for field selection
 * @param {{ prefix?: string, headers?: object }} params - Optional parameters
 * @returns {Promise<{data: any}>}
 */
export function createAction(modelName: string, payload: object, options?: {
    fields?: string | string[];
}, params?: {
    prefix?: string;
    headers?: object;
}): Promise<{
    data: any;
}>;
/**
 * Patch action - update an existing item
 *
 * @param {string} modelName - Model name: metadata 'name' or 'api_name'
 * @param {string|number} id - Item ID
 * @param {object} payload - Data to update
 * @param {{ fields?: string|string[] }} options - Options for field selection
 * @param {{ prefix?: string, headers?: object }} params - Optional parameters
 * @returns {Promise<{data: any}>}
 */
export function patchAction(modelName: string, id: string | number, payload: object, options?: {
    fields?: string | string[];
}, params?: {
    prefix?: string;
    headers?: object;
}): Promise<{
    data: any;
}>;
/**
 * Delete action - delete an item
 *
 * @param {string} modelName - Model name: metadata 'name' or 'api_name'
 * @param {string|number} id - Item ID
 * @param {{ prefix?: string, headers?: object }} params - Optional parameters
 * @returns {Promise<void>}
 */
export function deleteAction(modelName: string, id: string | number, params?: {
    prefix?: string;
    headers?: object;
}): Promise<void>;
/**
 * Export action - export items in a specific format
 *
 * @param {string} modelName - Model name: metadata 'name' or 'api_name'
 * @param {{ page?: number, size?: number, fields?: string|string[], filter?: string|object, orderBy?: string|string[], format?: string }} query - Standardized query parameters
 * @param {{ prefix?: string, headers?: object }} params - Optional parameters
 * @returns {Promise<any>}
 */
export function exportAction(modelName: string, query?: {
    page?: number;
    size?: number;
    fields?: string | string[];
    filter?: string | object;
    orderBy?: string | string[];
    format?: string;
}, params?: {
    prefix?: string;
    headers?: object;
}): Promise<any>;
/**
 * Import action - import items from a file (CSV, XLSX, ODS)
 *
 * @param {string} modelName - Model name: metadata 'name' or 'api_name'
 * @param {File} file - File to import
 * @param {{ prefix?: string, headers?: object }} params - Optional parameters
 * @returns {Promise<{data: {success: number, errors: number, created: number, updated: number, error_details?: Array<{row: number, error: string, data: object}>}}>}
 */
export function importAction(modelName: string, file: File, params?: {
    prefix?: string;
    headers?: object;
}): Promise<{
    data: {
        success: number;
        errors: number;
        created: number;
        updated: number;
        error_details?: Array<{
            row: number;
            error: string;
            data: object;
        }>;
    };
}>;
/**
 * Create an API service for a model.
 *
 * @param {string} modelName - Model name: metadata 'name' or 'api_name'
 * @param {{ prefix?: string, headers?: object }} defaultParams - Default parameters
 * @returns {object} - Service with CRUD methods
 */
export function useApiModel(modelName: string, defaultParams?: {
    prefix?: string;
    headers?: object;
}): object;
//# sourceMappingURL=api.d.ts.map