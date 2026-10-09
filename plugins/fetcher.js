/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { fetchBus, fetch } from '../network/fetch.js';
import { fetcherSrc } from '../directives/fetcher.js';
import { useAuthStore } from '../stores/auth.js';
import { ORIGIN_HEADER, originId } from '../utils/origin.js';

const defaultHeaders = {};
let defaultBaseUrl = '';
let isRefreshing = false;
let failedQueue = [];
let isRedirecting = false;

const processQueue = (error = null) => {
    const activeQueue = failedQueue.filter((prom) => !prom.signal || !prom.signal.aborted);

    activeQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve();
        }
    });

    failedQueue = [];
};

const cleanupAbortedRequests = () => {
    if (failedQueue.length > 0) {
        failedQueue = failedQueue.filter((prom) => !prom.signal || !prom.signal.aborted);
    }
};

const refreshToken = async () => {
    if (isRefreshing) {
        return new Promise((resolve) => {
            failedQueue.push({
                resolve: () => resolve(true),
                reject: () => resolve(false),
                signal: null,
            });
        });
    }

    isRefreshing = true;
    const authStore = useAuthStore();

    try {
        const refreshSuccess = await authStore.refreshAccessToken();

        if (refreshSuccess) {
            processQueue();

            return true;
        }

        // The auth store owns the logout decision: it keeps the session on
        // network/server errors and only logs out on an auth rejection.
        processQueue(new Error('Token refresh failed'));

        return false;
    } catch (refreshError) {
        processQueue(refreshError);

        return false;
    } finally {
        isRefreshing = false;
    }
};

/**
 * @param {String} baseUrl
 */
export function setDefaultBaseUrl(baseUrl) {
    defaultBaseUrl = baseUrl;
}

/**
 * @param {Object} headers
 */
export function setDefaultHeaders(headers) {
    Object.assign(defaultHeaders, headers || {});
}

/**
 * @param {String | null} token
 * @param {String} authType
 */
export function setDefaultAuthorization(token, authType = 'Bearer') {
    if (token) {
        defaultHeaders['Authorization'] = `${authType} ${token}`;
    } else {
        delete defaultHeaders['Authorization'];
    }
}

/**
 * @param {String} url
 *
 * @return {String|null}
 */
export function absoluteUrl(url) {
    if (!url) {
        return null;
    }

    if (url.startsWith('//') || url.includes('://')) {
        return url;
    }

    if (!url.startsWith('/')) {
        url = `/${url}`;
    }

    const base = getApiUrl();

    // A retried request comes back already resolved: resolving it a second time
    // would send it to `<base><base>/...`.
    if (base && (url === base || url.startsWith(`${base}/`))) {
        return url;
    }

    return `${base}${url}`;
}

export function getApiUrl() {
    return defaultBaseUrl;
}

/**
 * Stamp every request with the client instance that made it.
 *
 * The server hands it back on the announcement of that write, so this instance
 * can tell its own writes from someone else's news. A request that names its
 * own origin keeps it: a write of the api layer does, to have its echo known.
 * Nothing depends on it: a request without it is a write nobody can attribute,
 * which is exactly what an agent writing through the API is.
 *
 * @returns {function(): void} Stop stamping
 */
export const useOriginFetch = () => {
    const listener = (e) => {
        const { options } = e.detail;

        options.headers = { [ORIGIN_HEADER]: originId, ...options.headers };
    };

    fetchBus.addEventListener('fetch:request', listener);

    return () => fetchBus.removeEventListener('fetch:request', listener);
};

const TIMEZONE_HEADER = 'X-Timezone';

/**
 * Carry the timezone the application runs in on every request.
 *
 * The server anchors in it the dates a request sends without an offset, and
 * dates in it what it creates for this user. It is read again for each request,
 * so a device that travelled is followed. `resolve` replaces how it is read:
 * one that answers nothing sends no header, and the server keeps its default.
 *
 * @param {function(): (String|null|undefined)} [resolve]
 *
 * @returns {function(): void} Stop stamping
 */
export const useTimezoneFetch = (resolve = () => Intl.DateTimeFormat().resolvedOptions().timeZone) => {
    const listener = (e) => {
        const timezone = resolve();

        if (!timezone) {
            return;
        }

        const { options } = e.detail;

        options.headers = { [TIMEZONE_HEADER]: timezone, ...options.headers };
    };

    fetchBus.addEventListener('fetch:request', listener);

    return () => fetchBus.removeEventListener('fetch:request', listener);
};

/**
 * Carry the token on every request, and get a new one when it is refused.
 *
 * @returns {function(): void} Stop authorizing
 */
export const useAuthFetch = () => {
    const authorize = async (e) => {
        e.detail.url = absoluteUrl(e.detail.url);

        const authStore = useAuthStore();
        const { options, url } = e.detail;

        if (authStore.isAuthenticated && url && !url.includes('auth/refresh')) {
            if (authStore.isTokenExpired && authStore.canRefreshToken) {
                // Only the token is settled here. `fetch` waits on this and then
                // sends the request once, with the header this leaves behind:
                // sending it here as well is the same request twice on the wire.
                e.detail.next = refreshToken().then((refreshSuccess) => {
                    if (!refreshSuccess) {
                        throw new Error('Failed to refresh token');
                    }

                    options.headers = options.headers || {};
                    options.headers['Authorization'] = `Bearer ${authStore.token}`;
                });
            } else {
                options.headers = options.headers || {};
                options.headers['Authorization'] = `Bearer ${authStore.token}`;
            }
        }
    };

    const reauthorize = async (e) => {
        const authStore = useAuthStore();
        const { url, options, error } = e.detail;

        if (error?.response?.status !== 401 || url?.includes('auth/refresh')) {
            return;
        }

        if (!authStore.canRefreshToken) {
            if (!isRedirecting) {
                isRedirecting = true;
                await authStore.logout();
                isRedirecting = false;
            }

            return;
        }

        cleanupAbortedRequests();

        e.detail.next = new Promise((resolve, reject) => {
            const signal = options.signal || null;

            if (signal && signal.aborted) {
                reject(new DOMException('The operation was aborted.', 'AbortError'));
                return;
            }

            const queueItem = {
                resolve: async () => {
                    try {
                        if (signal && signal.aborted) {
                            reject(new DOMException('The operation was aborted.', 'AbortError'));

                            return;
                        }

                        const response = await fetch(url, options);

                        resolve(response);
                    } catch (retryError) {
                        reject(retryError);
                    }
                },
                reject,
                signal,
            };

            failedQueue.push(queueItem);

            if (signal) {
                signal.addEventListener(
                    'abort',
                    () => {
                        failedQueue = failedQueue.filter((item) => item !== queueItem);
                        reject(new DOMException('The operation was aborted.', 'AbortError'));
                    },
                    { once: true }
                );
            }
        });

        if (isRefreshing) {
            return;
        }

        await refreshToken();
    };

    fetchBus.addEventListener('fetch:request', authorize);
    fetchBus.addEventListener('fetch:error', reauthorize);

    return () => {
        fetchBus.removeEventListener('fetch:request', authorize);
        fetchBus.removeEventListener('fetch:error', reauthorize);
    };
};

const APP_PLACEHOLDER = '/{app}/';

/**
 * Resolve the context placeholders a request URL carries.
 *
 * `/{app}/` is the surface being served, which the application names for
 * itself (`surface`): a segment, or an empty string for an application served
 * at the root of the api, the placeholder then erased. Any other `/{name}/`
 * takes what `params` names for it, a segment or an empty string the same way.
 *
 * A placeholder nobody names stays where it is: for an application that does
 * not use it, or for whatever augments the fetcher to fill it on its own bus
 * (`fetch:request`).
 */
export const useUrlContextFetch = (
    /** @type {{surface?: String|null, params?: Record<String, String>}} */
    { surface = null, params = {} } = {}
) => {
    const fill = (url, placeholder, value) => url.replace(placeholder, value ? `/${value}/` : '/');

    const listener = (e) => {
        e.detail.url = absoluteUrl(e.detail.url);

        if (surface !== null && e.detail.url.includes(APP_PLACEHOLDER)) {
            e.detail.url = fill(e.detail.url, APP_PLACEHOLDER, surface);
        }

        for (const [name, value] of Object.entries(params)) {
            const placeholder = `/{${name}}/`;

            if (e.detail.url.includes(placeholder)) {
                e.detail.url = fill(e.detail.url, placeholder, value);
            }
        }
    };

    fetchBus.addEventListener('fetch:request', listener);

    return () => fetchBus.removeEventListener('fetch:request', listener);
};

/**
 * `surface` names what this application is, for `/{app}/`: a segment, or an
 * empty string for an application served at the root of the api. `params`
 * names what fills the other placeholders of a URL (`/{name}/`). `timezone`
 * replaces how the timezone every request carries is read.
 */
export const createFetcher = (options = {}) => {
    return {
        install(app) {
            const stops = [
                useOriginFetch(),
                useTimezoneFetch(options.timezone),
                useAuthFetch(),
                useUrlContextFetch(options),
            ];

            app.directive('fetcher-src', fetcherSrc);

            // The requests of an application are listened to while it lives: one
            // mounted again, as every test mounts one, is listened to once.
            app.onUnmount(() => stops.forEach((stop) => stop()));
        },
    };
};

setDefaultBaseUrl(import.meta.env.VITE_API_URL);
setDefaultAuthorization(localStorage.getItem('token'));
