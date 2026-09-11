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
 * can tell its own echo from someone else's news. Nothing depends on it: a
 * request without it is a write nobody can attribute, which is exactly what an
 * agent writing through the API is.
 *
 * @returns {function(): void} Stop stamping
 */
export declare const useOriginFetch: () => Function;
/**
 * Carry the token on every request, and get a new one when it is refused.
 *
 * @returns {function(): void} Stop authorizing
 */
export declare const useAuthFetch: () => Function;
/**
 * Resolve the context placeholders a request URL carries.
 *
 * Two of them, answering to different things. `{app}` is the surface being
 * served, which the application names for itself. `{workspace}` is the tenant
 * being read, which the workspace the user picked decides. Neither is a
 * question of role: deciding the tenant from a role is what leaves a console
 * user who is also a member of a workspace unable to read it.
 *
 * A surface named as an empty string is a surface with no segment of its own:
 * the placeholder is erased rather than filled, which is what an application
 * served at the root of the api needs. Naming none at all leaves the
 * placeholder where it is, for an application that does not use it.
 */
export declare const useUrlContextFetch: (
/** @type {{surface?: String|null, workspace?: Boolean, workspaceless?: String}} */
{ surface, workspace, workspaceless }?: {
    surface?: string | null;
    workspace?: boolean;
    workspaceless?: string;
}) => () => void;
/**
 * `surface` names what this application is, for `/{app}/`: a segment, or an
 * empty string for an application served at the root of the api. `workspace`
 * says whether it serves one workspace at a time, and `workspaceless` names
 * what stands where a tenant would, for what no workspace owns.
 */
export declare const createFetcher: (options?: {}) => {
    install(app: any): void;
};
//# sourceMappingURL=fetcher.d.ts.map