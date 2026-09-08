/**
 * Add record field values in route query parameters.
 *
 * @param {import('vue-router').RouteLocation} currentRoute The current route
 * @param {import('vue-router').RouteLocationRaw} route The new route to add queries to
 * @param {Object<String, String|String[]|object|null|undefined>} [query] The query to add to the route
 * @param {String} [prefix] The prefix to add to the query
 * @param {Boolean} [redirect] Whether to add a redirect to the route
 *
 * @returns {import('vue-router').RouteLocationRaw}
 */
export declare function addQueries(currentRoute: import('vue-router').RouteLocation, route: import('vue-router').RouteLocationRaw, query?: Record<string, string | object | string[] | null | undefined>, prefix?: string, redirect?: boolean): import('vue-router').RouteLocationRaw;
/**
 * Add redirect to route query parameters.
 *
 * @param {import('vue-router').RouteLocation} currentRoute The current route
 * @param {import('vue-router').RouteLocationRaw} route The route to add a redirect to
 * @param {Boolean} [keepUrlRedirect] Whether to keep the current redirect in the route
 *
 * @returns {import('vue-router').RouteLocationRaw}
 */
export declare function addRedirect(currentRoute: import('vue-router').RouteLocation, route: import('vue-router').RouteLocationRaw, keepUrlRedirect?: boolean): import('vue-router').RouteLocationRaw;
/**
 * Get redirect from route query parameters.
 *
 * @param {import('vue-router').RouteLocation} currentRoute The current route
 * @param {import('vue-router').RouteLocationRaw} fallbackRoute The fallback route to return if no redirect is found
 *
 * @returns {import('vue-router').RouteLocationRaw}
 */
export declare function getRedirect(currentRoute: import('vue-router').RouteLocation, fallbackRoute: import('vue-router').RouteLocationRaw): import('vue-router').RouteLocationRaw;
/**
 * Check if route has redirect.
 *
 * @param {import('vue-router').RouteLocationRaw} route The route to check for a redirect
 *
 * @returns {Boolean}
 */
export declare function hasRedirect(route: import('vue-router').RouteLocationRaw): boolean;
/**
 * Merge route query values in new route config and/or URLSearchParams.
 *
 * @param {Object<String, String|String[]|object|null|undefined>} query
 * @param {import('vue-router').RouteLocationRaw} [route] The route to merge the query values into
 * @param {String} [prefix] The prefix to add to the query
 * @param {URLSearchParams} [urlSearchParams] The URLSearchParams to merge the query values into
 */
export declare function mergeRouteQueryValues(query: Record<string, string | object | string[] | null | undefined>, route?: import('vue-router').RouteLocationRaw, prefix?: string, urlSearchParams?: URLSearchParams): void;
/**
 * Replace query values in route.
 *
 * @param {import('vue-router').Router} router The router
 * @param {Object<String, String|String[]|object|null|undefined>} query The query to replace in the route
 * @param {import('vue-router').RouteLocationRaw} [route] The route to replace the query in otherwise to use the current route
 * @param {String} [prefix] The prefix to add to the query
 */
export declare function replaceRouteQuery(router: import('vue-router').Router, query: Record<string, string | object | string[] | null | undefined>, route?: import('vue-router').RouteLocationRaw, prefix?: string): void;
/**
 * Restore route query.
 *
 * @param {String} query The query to restore
 * @param {import('vue-router').RouteLocation} currentRoute The current route to restore the query from
 * @param {String} [prefix] The prefix to add to the query
 * @param {*} [defaultValue] The default value to return if the query is not found
 * @param {String} [type] The type of the query
 *
 * @returns {*} The restored query value
 */
export declare function restoreRouteQuery(query: string, currentRoute: import('vue-router').RouteLocation, prefix?: string, defaultValue?: any, type?: string): any;
/**
 * Redirect if exist.
 *
 * @param {import('vue-router').Router} router The router
 *
 * @returns {Promise<Boolean>}
 */
export declare function redirectIfExist(router: import('vue-router').Router): Promise<boolean>;
//# sourceMappingURL=router.d.ts.map