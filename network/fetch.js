/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { EventBus } from '../composables/bus.js';

export const fetchBus = new EventBus();

export class HttpError extends Error {
    /**
     * @param {Response} response
     * @param {String}   message
     * @param {Object}   [data]
     */
    constructor(response, message, data) {
        super(message);
        this.response = response;
        this.data = data;
    }
}

/**
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/fetch)
 *
 * @param {RequestInfo | URL}                                                url
 * @param {RequestInit | {params?: object, body?: object | BodyInit | null}} [options]
 *
 * @returns Promise<Response&{data?: object}>
 */
export async function fetch(url, options = {}) {
    /**
     * @type {{url: (RequestInfo|URL), options: (RequestInit|{params?: Object}), next: Promise<void>}}
     */
    const payload = {
        url,
        options,
        next: null,
    };

    await fetchBus.triggerAndWait('fetch:request', payload);

    if (payload.next) {
        await payload.next;
    }

    url = payload.url;
    options = payload.options;

    try {
        if ('params' in options) {
            const params = typeof options.params === 'object' ? new URLSearchParams(options.params) : options.params;
            params.forEach((value, key) => {
                if (value === '' || value === undefined || value === 'undefined') {
                    params.delete(key);
                }
            });
            const query = params.toString();

            // A Request carries its own url: only a string or a URL takes a query here.
            if (query && (typeof url === 'string' || url instanceof URL)) {
                const target = url.toString();

                url = `${target}${target.includes('?') ? '&' : '?'}${query}`;
            }
        }

        const headers = { ...options.headers };
        let body = options.body;

        if ((typeof body === 'object' || typeof body === 'string') && !(body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';

            if (typeof body === 'object') {
                body = JSON.stringify(body);
            }
        }

        for (const [key, value] of Object.entries(headers)) {
            if ([undefined, null].includes(value)) {
                delete headers[key];
            }
        }

        const response = await window.fetch(url, {
            ...options,
            headers,
            body,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new HttpError(response, response.statusText, errorData);
        }

        const contentType = response.headers.get('content-type')?.split(';')[0].trim();

        if (contentType === 'application/json') {
            response.data = await response.json().catch(() => null);
        } else {
            response.data = {};
        }

        await fetchBus.triggerAndWait('fetch:success', { url, options, response, data: response.data });

        return response;
    } catch (error) {
        const errorPayload = {
            url,
            options,
            error,
            next: Promise.reject(error),
        };

        await fetchBus.triggerAndWait('fetch:error', errorPayload);

        return errorPayload.next;
    }
}
