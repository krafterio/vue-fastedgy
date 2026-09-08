/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { fetchBus, fetch } from '../network/fetch.js';
import { fetcherSrc } from '../directives/fetcher.js';
import { useAuthStore } from '../stores/auth.js';
import { useWorkspaceStore } from '../stores/workspace.js';
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
 * can tell its own echo from someone else's news. Nothing depends on it: a
 * request without it is a write nobody can attribute, which is exactly what an
 * agent writing through the API is.
 *
 * @returns {function(): void} Stop stamping
 */
export const useOriginFetch = () => {
    const listener = (e) => {
        const { options } = e.detail;

        options.headers = { ...options.headers, [ORIGIN_HEADER]: originId };
    };

    fetchBus.addEventListener('fetch:request', listener);

    return () => fetchBus.removeEventListener('fetch:request', listener);
};

export const useAuthFetch = () => {
    fetchBus.addEventListener('fetch:request', async (e) => {
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
    });

    fetchBus.addEventListener('fetch:error', async (e) => {
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
    });
};

const APP_PLACEHOLDER = '/{app}/';
const WORKSPACE_PLACEHOLDER = '/{workspace}/';

/**
 * Wait for a session that is still being restored.
 *
 * A request fired while the token is being refreshed would otherwise decide
 * on an anonymous user and address the wrong surface for the rest of its life.
 */
const untilAuthSettled = async (authStore) => {
    if (!authStore.loading) {
        return;
    }

    await new Promise((resolve) => {
        const unwatch = authStore.$subscribe((mutation, state) => {
            if (!state.loading) {
                unwatch();
                resolve();
            }
        });
    });
};

/**
 * Resolve the context placeholders a request URL carries.
 *
 * Two of them, answering to different things. `{app}` is the surface being
 * served, which the application names for itself. `{workspace}` is the tenant
 * being read, which the workspace the user picked decides. Neither is a
 * question of role: deciding the tenant from a role is what leaves a console
 * user who is also a member of a workspace unable to read it.
 */
export const useUrlContextFetch = (
    /** @type {{surface?: String|null, workspace?: Boolean, workspaceless?: String}} */
    { surface = null, workspace = false, workspaceless = 'global' } = {}
) => {
    const listener = async (e) => {
        e.detail.url = absoluteUrl(e.detail.url);

        if (surface && e.detail.url.includes(APP_PLACEHOLDER)) {
            e.detail.url = e.detail.url.replace(APP_PLACEHOLDER, `/${surface}/`);
        }

        if (e.detail.url.includes(WORKSPACE_PLACEHOLDER)) {
            const authStore = useAuthStore();

            await untilAuthSettled(authStore);

            let slug = null;

            // An application that serves no workspace never asks for the list:
            // a console user having one of their own must not turn the console
            // into a tenant.
            if (workspace) {
                const workspaceStore = useWorkspaceStore();

                await workspaceStore.load();

                slug = workspaceStore.slug;
            }

            e.detail.url = e.detail.url.replace(WORKSPACE_PLACEHOLDER, `/${slug ?? workspaceless}/`);
        }
    };

    fetchBus.addEventListener('fetch:request', listener);

    return () => fetchBus.removeEventListener('fetch:request', listener);
};

/**
 * `surface` names what this application is, for `/{app}/`. `workspace` says
 * whether it serves one workspace at a time, and `workspaceless` names what
 * stands where a tenant would, for what no workspace owns.
 */
export const createFetcher = (options = {}) => {
    return {
        install(app) {
            useOriginFetch();
            useAuthFetch();
            useUrlContextFetch(options);

            app.directive('fetcher-src', fetcherSrc);
        },
    };
};

setDefaultBaseUrl(import.meta.env.VITE_API_URL);
setDefaultAuthorization(localStorage.getItem('token'));
