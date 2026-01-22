/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { useFetcher } from "./fetcher.js";
import { useMetadataStore } from "../stores/metadata.js";
import { cleanPayload } from "../utils/models.js";

/**
 * Global API model configuration
 * @type {{ export?: { defaultRelationDelimiter?: 'newline' | 'semicolon' | 'comma' } }}
 */
let apiModelConfig = {};

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
export function createApiModel(config = {}) {
    apiModelConfig = config;
    return {
        install() {
            // Config is stored globally, no need to inject into app
        }
    };
}

/**
 * Get current API model configuration.
 *
 * @returns {{ export?: { defaultRelationDelimiter?: 'newline' | 'semicolon' | 'comma' } }}
 */
export function getApiModelConfig() {
    return apiModelConfig;
}

/**
 * Resolve model name to API name using metadata store
 * @param {string} modelName - Model name: metadata 'name' (e.g., 'user') or 'api_name' (e.g., 'users')
 * @returns {Promise<string>} - API name to use in URL
 */
async function resolveApiName(modelName) {
    const metadataStore = useMetadataStore();

    // Ensure metadatas are loaded
    await metadataStore.getMetadatas();

    const metadata = await metadataStore.getMetadata(modelName);

    // Use api_name from metadata if available, otherwise use modelName as-is (backward compatibility)
    return metadata?.api_name || modelName;
}

/**
 * Build URL with optional admin prefix
 * @param {string} modelName - Model name (e.g., 'tasks', 'users')
 * @param {string} path - Additional path (e.g., '', '/123', '/export')
 * @param {string} prefix - Prefix to use (e.g., '/admin')
 * @returns {string} - Built URL
 */
function buildUrl(modelName, path = "", prefix = "") {
    return `${prefix || ""}/${modelName}${path}`;
}

/**
 * Build query parameters from standardized query object
 * @param {{ page?: number, size?: number, orderBy?: string|string[], format?: string, relationDelimiter?: 'newline' | 'semicolon' | 'comma' }} query
 * @returns {object} - Query parameters for fetcher
 */
function buildQueryParams(query = {}) {
    const queryParams = {};

    // Standard pagination
    if (query.page != null && query.size != null) {
        queryParams.limit = query.size;
        queryParams.offset = (query.page - 1) * query.size;
    } else {
        if (query.size != null) queryParams.limit = query.size;
    }

    if (query.limit) {
        queryParams.limit = query.limit;
    }

    if (query.offset) {
        queryParams.offset = query.offset;
    }

    // Standard ordering
    if (query.orderBy != null) {
        queryParams.order_by = Array.isArray(query.orderBy)
            ? query.orderBy.join(",")
            : query.orderBy;
    }

    // Export format
    if (query.format != null) queryParams.format = query.format;

    // Relation delimiter for export
    if (query.relationDelimiter != null) {
        queryParams.relation_delimiter = query.relationDelimiter;
    }

    return queryParams;
}

/**
 * Build headers from standardized query and params
 * @param {{ fields?: string|string[], filter?: string|object }} query
 * @param {{ headers?: object }} params
 * @returns {object} - Headers for fetcher
 */
function buildHeaders(query = {}, params = {}) {
    const headers = { ...params.headers };

    if (query.fields != null) {
        headers["X-Fields"] = Array.isArray(query.fields)
            ? query.fields.join(",")
            : query.fields;
    }

    if (query.filter != null) {
        headers["X-Filter"] =
            typeof query.filter === "string"
                ? query.filter
                : JSON.stringify(query.filter);
    }

    return headers;
}

/**
 * List action with pagination and filters
 *
 * @param {string} modelName - Model name: metadata 'name' or 'api_name'
 * @param {{ page?: number, size?: number, fields?: string|string[], filter?: string|object, orderBy?: string|string[] }} query - Standardized query parameters
 * @param {{ prefix?: string, headers?: object }} params - Optional parameters
 * @returns {Promise<{data: {items: any[], total: number, limit: number, offset: number, total_pages: number}}>}
 */
export async function listAction(modelName, query = {}, params = {}) {
    const fetcher = useFetcher();
    const apiName = await resolveApiName(modelName);
    const queryParams = buildQueryParams(query);
    const headers = buildHeaders(query, params);
    const url = buildUrl(apiName, "", params.prefix);

    return await fetcher.get(url, { params: queryParams, headers });
}

/**
 * Get action - retrieve a single item by ID
 *
 * @param {string} modelName - Model name: metadata 'name' or 'api_name'
 * @param {string|number} id - Item ID
 * @param {{ fields?: string|string[] }} options - Options for field selection
 * @param {{ prefix?: string, headers?: object }} params - Optional parameters
 * @returns {Promise<{data: any}>}
 */
export async function getAction(modelName, id, options = {}, params = {}) {
    const fetcher = useFetcher();
    const apiName = await resolveApiName(modelName);
    const headers = buildHeaders(options, params);
    const url = buildUrl(apiName, `/${id}`, params.prefix);

    return await fetcher.get(url, { headers });
}

/**
 * Create action - create a new item
 *
 * @param {string} modelName - Model name: metadata 'name' or 'api_name'
 * @param {object} payload - Data to create
 * @param {{ fields?: string|string[] }} options - Options for field selection
 * @param {{ prefix?: string, headers?: object }} params - Optional parameters
 * @returns {Promise<{data: any}>}
 */
export async function createAction(
    modelName,
    payload,
    options = {},
    params = {}
) {
    const fetcher = useFetcher();
    const apiName = await resolveApiName(modelName);
    const headers = buildHeaders(options, params);
    const url = buildUrl(apiName, "", params.prefix);

    return await fetcher.post(url, cleanPayload(payload), { headers });
}

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
export async function patchAction(
    modelName,
    id,
    payload,
    options = {},
    params = {}
) {
    const fetcher = useFetcher();
    const apiName = await resolveApiName(modelName);
    const headers = buildHeaders(options, params);
    const url = buildUrl(apiName, `/${id}`, params.prefix);

    return await fetcher.patch(url, cleanPayload(payload), { headers });
}

/**
 * Delete action - delete an item
 *
 * @param {string} modelName - Model name: metadata 'name' or 'api_name'
 * @param {string|number} id - Item ID
 * @param {{ prefix?: string, headers?: object }} params - Optional parameters
 * @returns {Promise<void>}
 */
export async function deleteAction(modelName, id, params = {}) {
    const fetcher = useFetcher();
    const apiName = await resolveApiName(modelName);
    const headers = buildHeaders({}, params);
    const url = buildUrl(apiName, `/${id}`, params.prefix);

    return await fetcher.delete(url, { headers });
}

/**
 * Export action - export items in a specific format
 *
 * @param {string} modelName - Model name: metadata 'name' or 'api_name'
 * @param {{ page?: number, size?: number, fields?: string|string[], filter?: string|object, orderBy?: string|string[], format?: string, relationDelimiter?: 'newline' | 'semicolon' | 'comma' }} query - Standardized query parameters
 * @param {{ prefix?: string, headers?: object }} params - Optional parameters
 * @returns {Promise<any>}
 */
export async function exportAction(modelName, query = {}, params = {}) {
    const fetcher = useFetcher();
    const apiName = await resolveApiName(modelName);
    const config = getApiModelConfig();
    const { format = "csv", relationDelimiter, ...rest } = query;

    // Use config default if relationDelimiter not provided
    const effectiveRelationDelimiter = relationDelimiter ?? config.export?.defaultRelationDelimiter;

    const queryWithFormat = {
        ...rest,
        format,
        ...(effectiveRelationDelimiter && { relationDelimiter: effectiveRelationDelimiter }),
    };
    const queryParams = buildQueryParams(queryWithFormat);
    const headers = buildHeaders(queryWithFormat, params);
    const url = buildUrl(apiName, "/export", params.prefix);

    return await fetcher.get(url, { params: queryParams, headers });
}

/**
 * Import template action - download an import template file
 *
 * @param {string} modelName - Model name: metadata 'name' or 'api_name'
 * @param {{ fields?: string|string[], format?: string }} query - Query parameters (format: csv, xlsx, ods)
 * @param {{ prefix?: string, headers?: object }} params - Optional parameters
 * @returns {Promise<any>}
 */
export async function importTemplateAction(modelName, query = {}, params = {}) {
    const fetcher = useFetcher();
    const apiName = await resolveApiName(modelName);
    const { format = "csv", ...rest } = query;
    const queryWithFormat = { ...rest, format };
    const queryParams = buildQueryParams(queryWithFormat);
    const headers = buildHeaders(queryWithFormat, params);
    const url = buildUrl(apiName, "/import/template", params.prefix);

    return await fetcher.get(url, { params: queryParams, headers });
}

/**
 * Import action - import items from a file (CSV, XLSX, ODS)
 *
 * @param {string} modelName - Model name: metadata 'name' or 'api_name'
 * @param {File} file - File to import
 * @param {{ prefix?: string, headers?: object }} params - Optional parameters
 * @returns {Promise<{data: {success: number, errors: number, created: number, updated: number, error_details?: Array<{row: number, error: string, data: object}>}}>}
 */
export async function importAction(modelName, file, params = {}) {
    const fetcher = useFetcher();
    const apiName = await resolveApiName(modelName);
    const url = buildUrl(apiName, "/import", params.prefix);

    // Create FormData for file upload
    const formData = new FormData();
    formData.append("file", file);

    // Headers for FormData (don't set Content-Type, browser will set it with boundary)
    const headers = { ...params.headers };

    return await fetcher.post(url, formData, { headers });
}

/**
 * Create an API service for a model.
 *
 * @param {string} modelName - Model name: metadata 'name' or 'api_name'
 * @param {{ prefix?: string, headers?: object }} defaultParams - Default parameters
 * @returns {
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
export function useApiModel(modelName, defaultParams = {}) {
    return {
        /**
         * List items
         * @param {{ page?: number, size?: number, fields?: string|string[], filter?: string|object, orderBy?: string|string[] }} query
         * @param {{ prefix?: string, headers?: object }} params
         */
        list: (query = {}, params = {}) =>
            listAction(modelName, query, { ...defaultParams, ...params }),

        /**
         * Get item by ID
         * @param {string|number} id
         * @param {{ fields?: string|string[] }} options
         * @param {{ prefix?: string, headers?: object }} params
         */
        get: (id, options = {}, params = {}) =>
            getAction(modelName, id, options, {
                ...defaultParams,
                ...params,
            }),

        /**
         * Create item
         * @param {object} payload
         * @param {{ fields?: string|string[] }} options
         * @param {{ prefix?: string, headers?: object }} params
         */
        create: (payload, options = {}, params = {}) =>
            createAction(modelName, payload, options, {
                ...defaultParams,
                ...params,
            }),

        /**
         * Update item
         * @param {string|number} id
         * @param {object} payload
         * @param {{ fields?: string|string[] }} options
         * @param {{ prefix?: string, headers?: object }} params
         */
        update: (id, payload, options = {}, params = {}) =>
            patchAction(modelName, id, payload, options, {
                ...defaultParams,
                ...params,
            }),

        /**
         * Delete item
         * @param {string|number} id
         * @param {{ prefix?: string, headers?: object }} params
         */
        delete: (id, params = {}) =>
            deleteAction(modelName, id, { ...defaultParams, ...params }),

        /**
         * Export items
         * @param {{ page?: number, size?: number, fields?: string|string[], filter?: string|object, orderBy?: string|string[], format?: string, relationDelimiter?: 'newline' | 'semicolon' | 'comma' }} query
         * @param {{ prefix?: string, headers?: object }} params
         */
        export: (query = {}, params = {}) =>
            exportAction(modelName, query, { ...defaultParams, ...params }),

        /**
         * Download import template
         * @param {{ fields?: string|string[], format?: string }} query
         * @param {{ prefix?: string, headers?: object }} params
         */
        importTemplate: (query = {}, params = {}) =>
            importTemplateAction(modelName, query, {
                ...defaultParams,
                ...params,
            }),

        /**
         * Import items from file
         * @param {File} file - File to import (CSV, XLSX, ODS)
         * @param {{ prefix?: string, headers?: object }} params
         */
        import: (file, params = {}) =>
            importAction(modelName, file, { ...defaultParams, ...params }),
    };
}
