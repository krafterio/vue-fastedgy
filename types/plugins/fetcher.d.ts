/**
 * @param {String} baseUrl
 */
export function setDefaultBaseUrl(baseUrl: string): void;
/**
 * @param {Object} headers
 */
export function setDefaultHeaders(headers: any): void;
/**
 * @param {String | null} token
 * @param {String} authType
 */
export function setDefaultAuthorization(token: string | null, authType?: string): void;
/**
 * @param {String} url
 *
 * @return {String|null}
 */
export function absoluteUrl(url: string): string | null;
export function getApiUrl(): string;
export function useAuthFetch(): void;
export function createFetcher(): {
    install(app: any): void;
};
//# sourceMappingURL=fetcher.d.ts.map