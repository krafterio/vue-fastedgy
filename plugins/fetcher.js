/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import {fetchBus, fetch} from '../network/fetch.js';
import {fetcherSrc} from '../directives/fetcher.js';
import {useAuthStore} from '../stores/auth.js';

const defaultHeaders = {};
let defaultBaseUrl = '';
let isRefreshing = false;
let failedQueue = [];
let isRedirecting = false;

const processQueue = (error = null) => {
    const activeQueue = failedQueue.filter(prom => !prom.signal || !prom.signal.aborted);

    activeQueue.forEach(prom => {
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
        failedQueue = failedQueue.filter(prom => !prom.signal || !prom.signal.aborted);
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
        isRefreshing = false;

        if (refreshSuccess) {
            processQueue();

            return true;
        } else {
            processQueue(new Error('Token refresh failed'));

            if (!isRedirecting) {
                isRedirecting = true;
                await authStore.logout();
                isRedirecting = false;
            }

            return false;
        }
    } catch (refreshError) {
        processQueue(refreshError);

        if (!isRedirecting) {
            isRedirecting = true;
            await authStore.logout();
            isRedirecting = false;
        }

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

    return `${getApiUrl()}${url}`;
}

export function getApiUrl() {
    return defaultBaseUrl;
}

export const useAuthFetch = () => {
    fetchBus.addEventListener('fetch:request', async (e) => {
        e.detail.url = absoluteUrl(e.detail.url);

        const authStore = useAuthStore();
        const {options, url} = e.detail;

        if (authStore.isAuthenticated && !url.includes('auth/refresh')) {
            if (authStore.isTokenExpired && authStore.canRefreshToken) {
                e.detail.next = new Promise(async (resolve, reject) => {
                    try {
                        const refreshSuccess = await refreshToken();

                        if (refreshSuccess) {
                            options.headers = options.headers || {};
                            options.headers['Authorization'] = `Bearer ${authStore.token}`;

                            if (options.signal && options.signal.aborted) {
                                reject(new DOMException('The operation was aborted.', 'AbortError'));

                                return;
                            }

                            const response = await fetch(url, options);
                            resolve(response);
                        } else {
                            reject(new Error('Failed to refresh token'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            } else {
                options.headers = options.headers || {};
                options.headers['Authorization'] = `Bearer ${authStore.token}`;
            }
        }
    });

    fetchBus.addEventListener('fetch:error', async (e) => {
        const authStore = useAuthStore();
        const {url, options, error} = e.detail;

        if (error?.response?.status !== 401 || url.includes('auth/refresh')) {
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
                signal.addEventListener('abort', () => {
                    failedQueue = failedQueue.filter(item => item !== queueItem);
                    reject(new DOMException('The operation was aborted.', 'AbortError'));
                }, { once: true });
            }
        });

        if (isRefreshing) {
            return;
        }

        await refreshToken();
    });
}

export const createFetcher = () => {
    return {
        install(app) {
            useAuthFetch();

            app.directive('fetcher-src', fetcherSrc);
        }
    };
};

setDefaultBaseUrl(import.meta.env.VITE_API_URL);
setDefaultAuthorization(localStorage.getItem('token'));
