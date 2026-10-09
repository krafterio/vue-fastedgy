/**
 * @param {String} baseUrl
 */
export declare function setDefaultBaseUrl(baseUrl: string): void;
/**
 * @param {Object} headers
 */
export declare function setDefaultHeaders(headers: any): void;
/**
 * @param {String | null} token
 * @param {String} authType
 */
export declare function setDefaultAuthorization(token: string | null, authType?: string): void;
/**
 * @param {String} url
 *
 * @return {String|null}
 */
export declare function absoluteUrl(url: string): string | null;
export declare function getApiUrl(): string;
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
export declare const useOriginFetch: () => Function;
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
export declare const useTimezoneFetch: (resolve?: Function) => Function;
/**
 * Carry the token on every request, and get a new one when it is refused.
 *
 * @returns {function(): void} Stop authorizing
 */
export declare const useAuthFetch: () => Function;
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
export declare const useUrlContextFetch: (
/** @type {{surface?: String|null, params?: Record<String, String>}} */
{ surface, params }?: {
    surface?: string | null;
    params?: Record<string, string>;
}) => () => void;
/**
 * `surface` names what this application is, for `/{app}/`: a segment, or an
 * empty string for an application served at the root of the api. `params`
 * names what fills the other placeholders of a URL (`/{name}/`). `timezone`
 * replaces how the timezone every request carries is read.
 */
export declare const createFetcher: (options?: {}) => {
    install(app: any): void;
};
//# sourceMappingURL=fetcher.d.ts.map