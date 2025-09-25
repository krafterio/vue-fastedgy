/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { useFetcher } from './fetcher.js';

/**
 * Build URL with optional admin prefix
 * @param {string} resourceName - Resource name (e.g., 'tasks', 'users')
 * @param {string} path - Additional path (e.g., '', '/123', '/export')
 * @param {boolean} isAdmin - Whether to use admin prefix
 * @returns {string} - Built URL
 */
function buildUrl(resourceName, path = '', isAdmin = false) {
    const prefix = isAdmin ? '/admin' : '';
    return `${prefix}/${resourceName}${path}`;
}

/**
 * Build query parameters from standardized query object
 * @param {{ page?: number, size?: number, orderBy?: string|string[], format?: string }} query
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

    // Standard ordering
    if (query.orderBy != null) {
        queryParams.order_by = Array.isArray(query.orderBy)
            ? query.orderBy.join(',')
            : query.orderBy;
    }

    // Export format
    if (query.format != null) queryParams.format = query.format;

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
        headers['X-Fields'] = Array.isArray(query.fields)
            ? query.fields.join(',')
            : query.fields;
    }

    if (query.filter != null) {
        headers['X-Filter'] = typeof query.filter === 'string'
            ? query.filter
            : JSON.stringify(query.filter);
    }

    return headers;
}

/**
 * List action with pagination and filters
 *
 * @param {string} resourceName - Resource name (e.g., 'tasks', 'users')
 * @param {{ page?: number, size?: number, fields?: string|string[], filter?: string|object, orderBy?: string|string[] }} query - Standardized query parameters
 * @param {{ isAdmin?: boolean, headers?: object }} params - Optional parameters
 * @returns {Promise<{data: {items: any[], total: number, limit: number, offset: number, total_pages: number}}>}
 */
export async function listAction(resourceName, query = {}, params = {}) {
    const fetcher = useFetcher();
    const queryParams = buildQueryParams(query);
    const headers = buildHeaders(query, params);
    const url = buildUrl(resourceName, '', params.isAdmin);

    return await fetcher.get(url, { params: queryParams, headers });
}

/**
 * Get action - retrieve a single item by ID
 *
 * @param {string} resourceName - Resource name (e.g., 'tasks', 'users')
 * @param {string|number} id - Item ID
 * @param {{ fields?: string|string[] }} options - Options for field selection
 * @param {{ isAdmin?: boolean, headers?: object }} params - Optional parameters
 * @returns {Promise<{data: any}>}
 */
export async function getAction(resourceName, id, options = {}, params = {}) {
    const fetcher = useFetcher();
    const headers = buildHeaders(options, params);
    const url = buildUrl(resourceName, `/${id}`, params.isAdmin);

    return await fetcher.get(url, { headers });
}

/**
 * Create action - create a new item
 *
 * @param {string} resourceName - Resource name (e.g., 'tasks', 'users')
 * @param {object} payload - Data to create
 * @param {{ fields?: string|string[] }} options - Options for field selection
 * @param {{ isAdmin?: boolean, headers?: object }} params - Optional parameters
 * @returns {Promise<{data: any}>}
 */
export async function createAction(resourceName, payload, options = {}, params = {}) {
    const fetcher = useFetcher();
    const headers = buildHeaders(options, params);
    const url = buildUrl(resourceName, '', params.isAdmin);

    return await fetcher.post(url, payload, { headers });
}

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
export async function patchAction(resourceName, id, payload, options = {}, params = {}) {
    const fetcher = useFetcher();
    const headers = buildHeaders(options, params);
    const url = buildUrl(resourceName, `/${id}`, params.isAdmin);

    return await fetcher.patch(url, payload, { headers });
}

/**
 * Delete action - delete an item
 *
 * @param {string} resourceName - Resource name (e.g., 'tasks', 'users')
 * @param {string|number} id - Item ID
 * @param {{ isAdmin?: boolean, headers?: object }} params - Optional parameters
 * @returns {Promise<void>}
 */
export async function deleteAction(resourceName, id, params = {}) {
    const fetcher = useFetcher();
    const headers = buildHeaders({}, params);
    const url = buildUrl(resourceName, `/${id}`, params.isAdmin);

    return await fetcher.delete(url, { headers });
}

/**
 * Export action - export items in a specific format
 *
 * @param {string} resourceName - Resource name (e.g., 'tasks', 'users')
 * @param {{ page?: number, size?: number, fields?: string|string[], filter?: string|object, orderBy?: string|string[], format?: string }} query - Standardized query parameters
 * @param {{ isAdmin?: boolean, headers?: object }} params - Optional parameters
 * @returns {Promise<any>}
 */
export async function exportAction(resourceName, query = {}, params = {}) {
    const fetcher = useFetcher();
    const { format = 'csv', ...rest } = query;
    const queryWithFormat = { ...rest, format };
    const queryParams = buildQueryParams(queryWithFormat);
    const headers = buildHeaders(queryWithFormat, params);
    const url = buildUrl(resourceName, '/export', params.isAdmin);

    return await fetcher.get(url, { params: queryParams, headers });
}

/**
 * Create an API service for a resource
 *
 * @param {string} resourceName - Resource name (e.g., 'tasks', 'users')
 * @param {{ isAdmin?: boolean }} defaultParams - Default parameters
 * @returns {object} - Service with CRUD methods
 */
export function useApiService(resourceName, defaultParams = {}) {
    return {
        /**
         * List items
         * @param {{ page?: number, size?: number, fields?: string|string[], filter?: string|object, orderBy?: string|string[] }} query
         * @param {{ isAdmin?: boolean, headers?: object }} params
         */
        list: (query = {}, params = {}) =>
            listAction(resourceName, query, { ...defaultParams, ...params }),

        /**
         * Get item by ID
         * @param {string|number} id
         * @param {{ fields?: string|string[] }} options
         * @param {{ isAdmin?: boolean, headers?: object }} params
         */
        get: (id, options = {}, params = {}) =>
            getAction(resourceName, id, options, { ...defaultParams, ...params }),

        /**
         * Create item
         * @param {object} payload
         * @param {{ fields?: string|string[] }} options
         * @param {{ isAdmin?: boolean, headers?: object }} params
         */
        create: (payload, options = {}, params = {}) =>
            createAction(resourceName, payload, options, { ...defaultParams, ...params }),

        /**
         * Update item
         * @param {string|number} id
         * @param {object} payload
         * @param {{ fields?: string|string[] }} options
         * @param {{ isAdmin?: boolean, headers?: object }} params
         */
        update: (id, payload, options = {}, params = {}) =>
            patchAction(resourceName, id, payload, options, { ...defaultParams, ...params }),

        /**
         * Delete item
         * @param {string|number} id
         * @param {{ isAdmin?: boolean, headers?: object }} params
         */
        delete: (id, params = {}) =>
            deleteAction(resourceName, id, { ...defaultParams, ...params }),

        /**
         * Export items
         * @param {{ page?: number, size?: number, fields?: string|string[], filter?: string|object, orderBy?: string|string[], format?: string }} query
         * @param {{ isAdmin?: boolean, headers?: object }} params
         */
        export: (query = {}, params = {}) =>
            exportAction(resourceName, query, { ...defaultParams, ...params })
    };
}
