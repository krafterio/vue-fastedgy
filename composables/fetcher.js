/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import {onUnmounted} from 'vue';
import {fetch as _fetch} from 'vue-fastedgy/network/fetch';

/**
 * @param {{abortOnUnmounted: boolean}} options
 */
export function useFetcher(options = undefined) {
    const controllers = new Map();
    const opt = options || {};
    opt.abortOnUnmounted = 'abortOnUnmounted' in opt ? opt.abortOnUnmounted : true;

    /**
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/fetch).
     *
     * @param {RequestInfo | URL}                                                             url
     * @param {RequestInit | {id?: String, params?: Object, body?: Object | BodyInit | null}} [options]
     *
     * @returns Promise<Response&{data?: Object}>
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
    function abort(id = undefined) {
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
     * @param {RequestInit | {id?: String, params?: Object, body?: Object | BodyInit | null}} [options]
     *
     * @returns Promise<Response&{data?: Object}>
     */
    async function fetchGet(url, options = {}) {
        return await fetch(url, {...options, method: 'GET'});
    }

    /**
     * @param {RequestInfo | URL}                                                             url
     * @param {Object | BodyInit | null}                                                      body
     * @param {RequestInit | {id?: String, params?: Object, body?: Object | BodyInit | null}} [options]
     *
     * @returns Promise<Response&{data?: Object}>
     */
    async function fetchPost(url, body = null, options = {}) {
        return await fetch(url, {body, ...options, method: 'POST'});
    }

    /**
     * @param {RequestInfo | URL}                                                             url
     * @param {Object | BodyInit | null}                                                      body
     * @param {RequestInit | {id?: String, params?: Object, body?: Object | BodyInit | null}} [options]
     *
     * @returns Promise<Response&{data?: Object}>
     */
    async function fetchPut(url, body = null, options = {}) {
        return await fetch(url, {body, ...options, method: 'PUT'});
    }

    /**
     * @param {RequestInfo | URL}                                                             url
     * @param {Object | BodyInit | null}                                                      body
     * @param {RequestInit | {id?: String, params?: Object, body?: Object | BodyInit | null}} [options]
     *
     * @returns Promise<Response&{data?: Object}>
     */
    async function fetchPatch(url, body = null, options = {}) {
        return await fetch(url, {body, ...options, method: 'PATCH'});
    }

    /**
     * @param {RequestInfo | URL}                                                             url
     * @param {RequestInit | {id?: String, params?: Object, body?: Object | BodyInit | null}} [options]
     *
     * @returns Promise<Response&{data?: Object}>
     */
    async function fetchDelete(url, options = {}) {
        return await fetch(url, {...options, method: 'DELETE'});
    }

    if (opt.abortOnUnmounted) {
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

export function useFetcherService(options = undefined) {
    return useFetcher(Object.assign({abortOnUnmounted: false}, options || {}));
}
