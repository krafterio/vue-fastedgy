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
    }) => Promise<Response | {
        data: {};
    }>;
    abort: (id?: string) => void;
    get: (url: RequestInfo | URL, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response | {
        data: {};
    }>;
    post: (url: RequestInfo | URL, body?: any | BodyInit | null, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response | {
        data: {};
    }>;
    put: (url: RequestInfo | URL, body?: any | BodyInit | null, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response | {
        data: {};
    }>;
    patch: (url: RequestInfo | URL, body?: any | BodyInit | null, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response | {
        data: {};
    }>;
    delete: (url: RequestInfo | URL, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response | {
        data: {};
    }>;
};
export function useFetcherService(options?: any): {
    fetch: (url: RequestInfo | URL, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response | {
        data: {};
    }>;
    abort: (id?: string) => void;
    get: (url: RequestInfo | URL, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response | {
        data: {};
    }>;
    post: (url: RequestInfo | URL, body?: any | BodyInit | null, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response | {
        data: {};
    }>;
    put: (url: RequestInfo | URL, body?: any | BodyInit | null, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response | {
        data: {};
    }>;
    patch: (url: RequestInfo | URL, body?: any | BodyInit | null, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response | {
        data: {};
    }>;
    delete: (url: RequestInfo | URL, options?: RequestInit | {
        id?: string;
        params?: any;
        body?: any | BodyInit | null;
    }) => Promise<Response | {
        data: {};
    }>;
};
//# sourceMappingURL=fetcher.d.ts.map