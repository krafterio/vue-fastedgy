/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { getCurrentInstance, onUnmounted } from 'vue';
import { fetch as _fetch } from '../network/fetch.js';

/**
 * @param {{abortOnUnmounted: boolean}} options
 */
export function useFetcher(options) {
    const controllers = new Map();
    const opt = options || {};
    opt.abortOnUnmounted = 'abortOnUnmounted' in opt ? opt.abortOnUnmounted : true;

    /**
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/fetch).
     *
     * @param {RequestInfo | URL}                                                             url
     * @param {RequestInit | {id?: String, params?: object, body?: object | BodyInit | null}} [options]
     *
     * @returns Promise<Response&{data?: object}>
     */
    async function fetch(url, options = {}) {
        const id = options?.['id'] || url;

        if (!options.signal && !(url instanceof Request)) {
            const controller = new AbortController();
            options.signal = controller.signal;
            controllers.set(id, controller);
        }

        try {
            return await _fetch(url, options);
        } finally {
            controllers.delete(id);
        }
    }

    /**
     * Aborts all requests or a specific request by id in component.
     *
     * @param {String} [id]
     */
    function abort(id) {
        if (id) {
            controllers.get(id)?.abort('Abort request');
            controllers.delete(id);
        } else {
            for (const controller of controllers.values()) {
                controller.abort('Abort all requests');
            }

            controllers.clear();
        }
    }

    /**
     * @param {RequestInfo | URL}                                                             url
     * @param {RequestInit | {id?: String, params?: object, body?: object | BodyInit | null}} [options]
     *
     * @returns Promise<Response&{data?: object}>
     */
    async function fetchGet(url, options = {}) {
        return await fetch(url, { ...options, method: 'GET' });
    }

    /**
     * @param {RequestInfo | URL}                                                             url
     * @param {object | BodyInit | null}                                                      body
     * @param {RequestInit | {id?: String, params?: object, body?: object | BodyInit | null}} [options]
     *
     * @returns Promise<Response&{data?: object}>
     */
    async function fetchPost(url, body = null, options = {}) {
        return await fetch(url, { body, ...options, method: 'POST' });
    }

    /**
     * @param {RequestInfo | URL}                                                             url
     * @param {object | BodyInit | null}                                                      body
     * @param {RequestInit | {id?: String, params?: object, body?: object | BodyInit | null}} [options]
     *
     * @returns Promise<Response&{data?: object}>
     */
    async function fetchPut(url, body = null, options = {}) {
        return await fetch(url, { body, ...options, method: 'PUT' });
    }

    /**
     * @param {RequestInfo | URL}                                                             url
     * @param {object | BodyInit | null}                                                      body
     * @param {RequestInit | {id?: String, params?: object, body?: object | BodyInit | null}} [options]
     *
     * @returns Promise<Response&{data?: object}>
     */
    async function fetchPatch(url, body = null, options = {}) {
        return await fetch(url, { body, ...options, method: 'PATCH' });
    }

    /**
     * @param {RequestInfo | URL}                                                             url
     * @param {RequestInit | {id?: String, params?: object, body?: object | BodyInit | null}} [options]
     *
     * @returns Promise<Response&{data?: object}>
     */
    async function fetchDelete(url, options = {}) {
        return await fetch(url, { ...options, method: 'DELETE' });
    }

    // Aborting on unmount only means something to a caller that is a component
    // being set up. An api model reached from an event handler, a store or a
    // test has no instance to hang the hook on, and asking for one there is
    // what makes Vue warn about a lifecycle call outside setup.
    if (opt.abortOnUnmounted && getCurrentInstance()) {
        onUnmounted(() => {
            abort();
        });
    }

    return {
        fetch,
        abort,
        get: fetchGet,
        post: fetchPost,
        put: fetchPut,
        patch: fetchPatch,
        delete: fetchDelete,
    };
}

export function useFetcherService(options) {
    return useFetcher(Object.assign({ abortOnUnmounted: false }, options || {}));
}
