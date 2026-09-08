/**
 * @param {{abortOnUnmounted: boolean}} options
 */
export declare function useFetcher(options: {
    abortOnUnmounted: boolean;
}): {
    fetch: (url: RequestInfo | URL, options?: RequestInit | {
        id?: string;
        params?: object;
        body?: object | BodyInit | null;
    }) => Promise<Response>;
    abort: (id?: string | undefined) => void;
    get: (url: RequestInfo | URL, options?: RequestInit | {
        id?: string;
        params?: object;
        body?: object | BodyInit | null;
    }) => Promise<Response>;
    post: (url: RequestInfo | URL, body?: object | BodyInit | null, options?: RequestInit | {
        id?: string;
        params?: object;
        body?: object | BodyInit | null;
    }) => Promise<Response>;
    put: (url: RequestInfo | URL, body?: object | BodyInit | null, options?: RequestInit | {
        id?: string;
        params?: object;
        body?: object | BodyInit | null;
    }) => Promise<Response>;
    patch: (url: RequestInfo | URL, body?: object | BodyInit | null, options?: RequestInit | {
        id?: string;
        params?: object;
        body?: object | BodyInit | null;
    }) => Promise<Response>;
    delete: (url: RequestInfo | URL, options?: RequestInit | {
        id?: string;
        params?: object;
        body?: object | BodyInit | null;
    }) => Promise<Response>;
};
export declare function useFetcherService(options: any): {
    fetch: (url: RequestInfo | URL, options?: RequestInit | {
        id?: string;
        params?: object;
        body?: object | BodyInit | null;
    }) => Promise<Response>;
    abort: (id?: string | undefined) => void;
    get: (url: RequestInfo | URL, options?: RequestInit | {
        id?: string;
        params?: object;
        body?: object | BodyInit | null;
    }) => Promise<Response>;
    post: (url: RequestInfo | URL, body?: object | BodyInit | null, options?: RequestInit | {
        id?: string;
        params?: object;
        body?: object | BodyInit | null;
    }) => Promise<Response>;
    put: (url: RequestInfo | URL, body?: object | BodyInit | null, options?: RequestInit | {
        id?: string;
        params?: object;
        body?: object | BodyInit | null;
    }) => Promise<Response>;
    patch: (url: RequestInfo | URL, body?: object | BodyInit | null, options?: RequestInit | {
        id?: string;
        params?: object;
        body?: object | BodyInit | null;
    }) => Promise<Response>;
    delete: (url: RequestInfo | URL, options?: RequestInit | {
        id?: string;
        params?: object;
        body?: object | BodyInit | null;
    }) => Promise<Response>;
};
//# sourceMappingURL=fetcher.d.ts.map