/**
 * Create and configure API model defaults.
 *
 * @param {{ export?: { defaultRelationDelimiter?: 'newline' | 'semicolon' | 'comma' } }} config - Configuration options
 * @returns {import("vue").Plugin} - Vue plugin
 *
 * @example
 * // In main.js
 * import { createApiModel } from 'vue-fastedgy';
 *
 * const apiModel = createApiModel({
 *     export: {
 *         defaultRelationDelimiter: 'semicolon'
 *     }
 * });
 *
 * app.use(apiModel);
 */
export declare function createApiModel(config?: {
    export?: {
        defaultRelationDelimiter?: 'newline' | 'semicolon' | 'comma';
    };
}): import("vue").Plugin;
/**
 * Get current API model configuration.
 *
 * @returns {{ export?: { defaultRelationDelimiter?: 'newline' | 'semicolon' | 'comma' } }}
 */
export declare function getApiModelConfig(): {
    export?: {
        defaultRelationDelimiter?: 'newline' | 'semicolon' | 'comma';
    };
};
/**
 * List action with pagination and filters
 *
 * @param {string} modelName - Model name: metadata 'name' or 'api_name'
 * @param {{ page?: number, size?: number, fields?: string|string[], filter?: string|object, orderBy?: string|string[] }} query - Standardized query parameters
 * @param {{ prefix?: string, headers?: object }} params - Optional parameters
 * @returns {Promise<{data: {items: any[], total: number, limit: number, offset: number, total_pages: number}}>}
 */
export declare function listAction(modelName: string, query?: {
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
export declare function getAction(modelName: string, id: string | number, options?: {
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
export declare function createAction(modelName: string, payload: object, options?: {
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
export declare function patchAction(modelName: string, id: string | number, payload: object, options?: {
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
export declare function deleteAction(modelName: string, id: string | number, params?: {
    prefix?: string;
    headers?: object;
}): Promise<void>;
/**
 * Action a model answers to outside the routes generated for it.
 *
 * The api name and the surface are resolved as they are everywhere else, so a
 * model with an endpoint of its own is still addressed by its metadata name.
 *
 * @param {string} modelName - Model name: metadata 'name' or 'api_name'
 * @param {string} method - get, post, patch, put or delete
 * @param {string} path - What follows the model in the url, e.g. '/12/generate-image'
 * @param {object} [body] - Body of a write
 * @param {{ fields?: string|string[], filter?: string|object, page?: number, size?: number,
 *           limit?: number, offset?: number, orderBy?: string|string[] }} [query]
 * @param {{ prefix?: string, headers?: object }} [params]
 * @returns {Promise<{data: any}>}
 */
export declare function actionRequest(modelName: string, method: string, path?: string, body?: object, query?: {
    fields?: string | string[];
    filter?: string | object;
    page?: number;
    size?: number;
    limit?: number;
    offset?: number;
    orderBy?: string | string[];
}, params?: {
    prefix?: string;
    headers?: object;
}): Promise<{
    data: any;
}>;
/**
 * Export action - export items in a specific format
 *
 * @param {string} modelName - Model name: metadata 'name' or 'api_name'
 * @param {{ page?: number, size?: number, fields?: string|string[], filter?: string|object, orderBy?: string|string[], format?: string, relationDelimiter?: 'newline' | 'semicolon' | 'comma' }} query - Standardized query parameters
 * @param {{ prefix?: string, headers?: object }} params - Optional parameters
 * @returns {Promise<any>}
 */
export declare function exportAction(modelName: string, query?: {
    page?: number;
    size?: number;
    fields?: string | string[];
    filter?: string | object;
    orderBy?: string | string[];
    format?: string;
    relationDelimiter?: 'newline' | 'semicolon' | 'comma';
}, params?: {
    prefix?: string;
    headers?: object;
}): Promise<any>;
/**
 * Import template action - download an import template file
 *
 * @param {string} modelName - Model name: metadata 'name' or 'api_name'
 * @param {{ fields?: string|string[], format?: string }} query - Query parameters (format: csv, xlsx, ods)
 * @param {{ prefix?: string, headers?: object }} params - Optional parameters
 * @returns {Promise<any>}
 */
export declare function importTemplateAction(modelName: string, query?: {
    fields?: string | string[];
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
export declare function importAction(modelName: string, file: File, params?: {
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
 * Write a record and hold what the form needs to know while it is written.
 *
 * The id decides: a record that has one is updated, a record that has none is
 * created. A write already under way is not started twice, and a server that
 * refuses raises, the form saying so as it sees fit.
 *
 * @param {string|object} model - Model name: metadata 'name' or 'api_name', or an api model
 * @param {{params?: object, fields?: string|string[]}} [options]
 * @returns {{saving: import("vue").Ref<boolean>,
 *            save: (id: (string|number|null), payload: object) => Promise<any>,
 *            remove: (id: (string|number)) => Promise<void>}}
 *
 * @example
 * const { saving, save, remove } = useApiForm('vehicle');
 *
 * await save(vehicle.id, { name });
 */
export declare function useApiForm(model: string | object, options?: {
    params?: object;
    fields?: string | string[];
}): {
    saving: import("vue").Ref<boolean>;
    save: (id: (string | number | null), payload: object) => Promise<any>;
    remove: (id: (string | number)) => Promise<void>;
};
/**
 * Create an API service for a model.
 *
 * @param {string} modelName - Model name: metadata 'name' or 'api_name'
 * @param {{ prefix?: string, headers?: object }} defaultParams - Default parameters
 * @returns {
 *  modelName: string,
 *  action: (method, path, body = undefined, query = {}, params = {}) => Promise<{data: any}>,
 *  list: (query = {}, params = {}) => Promise<{data: {items: any[], total: number, limit: number, offset: number, total_pages: number}}>,
 *  get: (id, options = {}, params = {}) => Promise<{data: any}>,
 *  create: (payload, options = {}, params = {}) => Promise<{data: any}>,
 *  update: (id, payload, options = {}, params = {}) => Promise<{data: any}>,
 *  delete: (id, params = {}) => Promise<void>,
 *  export: (query = {}, params = {}) => Promise<any>,
 *  importTemplate: (query = {}, params = {}) => Promise<any>,
 *  import: (file, params = {}) => Promise<{data: {success: number, errors: number, created: number, updated: number, error_details?: Array<{row: number, error: string, data: object}>}}>
 * } - Service with CRUD methods
 */
export declare function useApiModel(modelName: string, defaultParams?: {
    prefix?: string;
    headers?: object;
}): any;
//# sourceMappingURL=api.d.ts.map