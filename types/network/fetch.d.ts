import { EventBus } from '../composables/bus.js';
export declare const fetchBus: EventBus;
export declare class HttpError extends Error {
    response: Response;
    data: any;
    /**
     * @param {Response} response
     * @param {String}   message
     * @param {Object}   [data]
     */
    constructor(response: Response, message: string, data?: any);
}
/**
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/fetch)
 *
 * @param {RequestInfo | URL}                                                url
 * @param {RequestInit | {params?: object, body?: object | BodyInit | null}} [options]
 *
 * @returns Promise<Response&{data?: object}>
 */
export declare function fetch(url: RequestInfo | URL, options?: RequestInit | {
    params?: object;
    body?: object | BodyInit | null;
}): Promise<Response>;
//# sourceMappingURL=fetch.d.ts.map