/**
 * @param {{abortOnUnmounted: boolean}} options
 */
export function useFetcher(options?: {
    abortOnUnmounted: boolean;
}): {
    fetch: (url: RequestInfo | URL, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response>;
    abort: (id?: string) => void;
    get: (url: RequestInfo | URL, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response>;
    post: (url: RequestInfo | URL, body?: any | BodyInit | null, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response>;
    put: (url: RequestInfo | URL, body?: any | BodyInit | null, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response>;
    patch: (url: RequestInfo | URL, body?: any | BodyInit | null, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response>;
    delete: (url: RequestInfo | URL, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response>;
};
export function useFetcherService(options?: any): {
    fetch: (url: RequestInfo | URL, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response>;
    abort: (id?: string) => void;
    get: (url: RequestInfo | URL, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response>;
    post: (url: RequestInfo | URL, body?: any | BodyInit | null, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response>;
    put: (url: RequestInfo | URL, body?: any | BodyInit | null, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response>;
    patch: (url: RequestInfo | URL, body?: any | BodyInit | null, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response>;
    delete: (url: RequestInfo | URL, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response>;
};
//# sourceMappingURL=fetcher.d.ts.map