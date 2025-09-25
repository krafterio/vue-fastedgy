/**
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/fetch)
 *
 * @param {RequestInfo | URL}                                                url
 * @param {RequestInit | {params?: Object, body?: Object | BodyInit | null}} [options]
 *
 * @returns Promise<Response&{data?: Object}>
 */
export function fetch(url: RequestInfo | URL, options?: RequestInit | {
    params?: any;
    body?: any | BodyInit | null;
}): Promise<Response | {
    data: {};
}>;
export const fetchBus: EventBus;
export class HttpError extends Error {
    /**
     * @param {Response} response
     * @param {String}   message
     * @param {Object}   [data]
     */
    constructor(response: Response, message?: string, data?: any);
    response: Response;
    data: any;
}
import { EventBus } from 'vue-fastedgy/composables/bus';
//# sourceMappingURL=fetch.d.ts.map