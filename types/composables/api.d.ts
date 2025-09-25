/**
 * List action with pagination and filters
 *
 * @param {string} resourceName - Resource name (e.g., 'tasks', 'users')
 * @param {{ page?: number, size?: number, fields?: string|string[], filter?: string|object, orderBy?: string|string[] }} query - Standardized query parameters
 * @param {{ isAdmin?: boolean, headers?: object }} params - Optional parameters
 * @returns {Promise<{data: {items: any[], total: number, limit: number, offset: number, total_pages: number}}>}
 */
export function listAction(resourceName: string, query?: {
    page?: number;
    size?: number;
    fields?: string | string[];
    filter?: string | object;
    orderBy?: string | string[];
}, params?: {
    isAdmin?: boolean;
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
 * @param {string} resourceName - Resource name (e.g., 'tasks', 'users')
 * @param {string|number} id - Item ID
 * @param {{ fields?: string|string[] }} options - Options for field selection
 * @param {{ isAdmin?: boolean, headers?: object }} params - Optional parameters
 * @returns {Promise<{data: any}>}
 */
export function getAction(resourceName: string, id: string | number, options?: {
    fields?: string | string[];
}, params?: {
    isAdmin?: boolean;
    headers?: object;
}): Promise<{
    data: any;
}>;
/**
 * Create action - create a new item
 *
 * @param {string} resourceName - Resource name (e.g., 'tasks', 'users')
 * @param {object} payload - Data to create
 * @param {{ fields?: string|string[] }} options - Options for field selection
 * @param {{ isAdmin?: boolean, headers?: object }} params - Optional parameters
 * @returns {Promise<{data: any}>}
 */
export function createAction(resourceName: string, payload: object, options?: {
    fields?: string | string[];
}, params?: {
    isAdmin?: boolean;
    headers?: object;
}): Promise<{
    data: any;
}>;
/**
 * Patch action - update an existing item
 *
 * @param {string} resourceName - Resource name (e.g., 'tasks', 'users')
 * @param {string|number} id - Item ID
 * @param {object} payload - Data to update
 * @param {{ fields?: string|string[] }} options - Options for field selection
 * @param {{ isAdmin?: boolean, headers?: object }} params - Optional parameters
 * @returns {Promise<{data: any}>}
 */
export function patchAction(resourceName: string, id: string | number, payload: object, options?: {
    fields?: string | string[];
}, params?: {
    isAdmin?: boolean;
    headers?: object;
}): Promise<{
    data: any;
}>;
/**
 * Delete action - delete an item
 *
 * @param {string} resourceName - Resource name (e.g., 'tasks', 'users')
 * @param {string|number} id - Item ID
 * @param {{ isAdmin?: boolean, headers?: object }} params - Optional parameters
 * @returns {Promise<void>}
 */
export function deleteAction(resourceName: string, id: string | number, params?: {
    isAdmin?: boolean;
    headers?: object;
}): Promise<void>;
/**
 * Export action - export items in a specific format
 *
 * @param {string} resourceName - Resource name (e.g., 'tasks', 'users')
 * @param {{ page?: number, size?: number, fields?: string|string[], filter?: string|object, orderBy?: string|string[], format?: string }} query - Standardized query parameters
 * @param {{ isAdmin?: boolean, headers?: object }} params - Optional parameters
 * @returns {Promise<any>}
 */
export function exportAction(resourceName: string, query?: {
    page?: number;
    size?: number;
    fields?: string | string[];
    filter?: string | object;
    orderBy?: string | string[];
    format?: string;
}, params?: {
    isAdmin?: boolean;
    headers?: object;
}): Promise<any>;
/**
 * Create an API service for a resource
 *
 * @param {string} resourceName - Resource name (e.g., 'tasks', 'users')
 * @param {{ isAdmin?: boolean }} defaultParams - Default parameters
 * @returns {object} - Service with CRUD methods
 */
export function useApiService(resourceName: string, defaultParams?: {
    isAdmin?: boolean;
}): object;
//# sourceMappingURL=api.d.ts.map