/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

/**
 * Add record field values in route query parameters.
 *
 * @param {import('vue-router').RouteLocation} currentRoute The current route
 * @param {import('vue-router').RouteLocationRaw} route The new route to add queries to
 * @param {Object<String, String|String[]|Object|Object[]|null|undefined>} [query] The query to add to the route
 * @param {String} [prefix] The prefix to add to the query
 * @param {Boolean} [redirect] Whether to add a redirect to the route
 *
 * @returns {import('vue-router').RouteLocationRaw}
 */
export function addQueries(currentRoute, route, query, prefix = undefined, redirect = false) {
    if (query) {
        mergeRouteQueryValues(query, route, prefix);
    }

    if (redirect) {
        addRedirect(currentRoute, route);
    }

    return route;
};

/**
 * Add redirect to route query parameters.
 *
 * @param {import('vue-router').RouteLocation} currentRoute The current route
 * @param {import('vue-router').RouteLocationRaw} route The route to add a redirect to
 * @param {Boolean} [keepUrlRedirect] Whether to keep the current redirect in the route
 *
 * @returns {import('vue-router').RouteLocationRaw}
 */
export function addRedirect(currentRoute, route, keepUrlRedirect = false) {
    // Prefer to use window location that the Route.fullPath value to get the latest edited queries
    const queryParams = new URLSearchParams(window.location.search);
    const search = '?' + queryParams.toString();
    const fullPath = currentRoute.path + ('?' === search ? '' : search);

    route.query = route.query || {};

    if (keepUrlRedirect && typeof currentRoute?.query?.redirect === 'string') {
        route.query.redirect = currentRoute.query.redirect;
    } else {
        route.query.redirect = encodeURIComponent(fullPath);
    }

    return route;
};

/**
 * Get redirect from route query parameters.
 *
 * @param {import('vue-router').RouteLocation} currentRoute The current route
 * @param {import('vue-router').RouteLocationRaw} fallbackRoute The fallback route to return if no redirect is found
 *
 * @returns {import('vue-router').RouteLocationRaw}
 */
export function getRedirect(currentRoute, fallbackRoute) {
    if (typeof currentRoute?.query?.redirect === 'string') {
        return decodeURIComponent(currentRoute.query.redirect);
    }

    return fallbackRoute;
};

/**
 * Check if route has redirect.
 *
 * @param {import('vue-router').RouteLocationRaw} route The route to check for a redirect
 *
 * @returns {Boolean}
 */
export function hasRedirect(route) {
    return typeof route?.query?.redirect === 'string';
};

/**
 * Merge route query values in new route config and/or URLSearchParams.
 *
 * @param {Object<String, String|String[]|Object|Object[]|null|undefined>} query
 * @param {import('vue-router').RouteLocationRaw} [route] The route to merge the query values into
 * @param {String} [prefix] The prefix to add to the query
 * @param {URLSearchParams} [urlSearchParams] The URLSearchParams to merge the query values into
 */
export function mergeRouteQueryValues(query, route = undefined, prefix = undefined, urlSearchParams = undefined) {
    for (const key in query) {
        if (query.hasOwnProperty(key)) {
            const queryKey = prefix ? prefix + '_' + key : key;
            const value = query[key];
            let queryValue;

            if (null === value || undefined === value) {
                if (urlSearchParams) {
                    urlSearchParams.delete(queryKey);
                }

                if (route && undefined !== route.query) {
                    delete route.query[queryKey];
                }
            } else {
                if (typeof value === 'object') {
                    if (Array.isArray(value)) {
                        queryValue = encodeURIComponent(value.toString());
                    } else {
                        queryValue = window.btoa(unescape(encodeURIComponent(
                            typeof value === 'object' ? JSON.stringify(value) : value,
                        )));
                    }
                } else {
                    queryValue = encodeURIComponent(value);
                }

                if (urlSearchParams) {
                    urlSearchParams.set(queryKey, queryValue);
                }

                if (route) {
                    if (undefined === route.query) {
                        route.query = {};
                    }

                    route.query[queryKey] = queryValue;
                }
            }
        }
    }
}

/**
 * Replace query values in route.
 *
 * @param {import('vue-router').Router} router The router
 * @param {Object<String, String|String[]|Object|Object[]|null|undefined>} query The query to replace in the route
 * @param {import('vue-router').RouteLocationRaw} [route] The route to replace the query in otherwise to use the current route
 * @param {String} [prefix] The prefix to add to the query
 */
export function replaceRouteQuery(router, query, route = undefined, prefix = undefined) {
    if (!route) {
        if (!router?.currentRoute) {
            return;
        }

        route = router.currentRoute;
    }

    const nextRoute = {query: route?.query};
    mergeRouteQueryValues(query, nextRoute, prefix);
    router.replace({query: nextRoute.query});
}

/**
 * Restore route query.
 *
 * @param {String} query The query to restore
 * @param {import('vue-router').RouteLocation} currentRoute The current route to restore the query from
 * @param {String} [prefix] The prefix to add to the query
 * @param {*|undefined} [defaultValue] The default value to return if the query is not found
 * @param {String} [type] The type of the query
 *
 * @returns {*|undefined} The restored query value
 */
export function restoreRouteQuery(query, currentRoute, prefix = undefined, defaultValue = undefined, type = undefined) {
    const queryKey = prefix ? prefix + '_' + query : query;
    let value;

    if (currentRoute.query.hasOwnProperty(queryKey)) {
        value = currentRoute.query[queryKey];
    }

    if (type && undefined !== value) {
        switch (type) {
            case 'number':
                value = parseInt(decodeURIComponent(value), 10);
                break;
            case 'array':
                value = decodeURIComponent(value);
                value = value.split(',');

                break;
            case 'array_number':
                value = decodeURIComponent(value);
                value = value.split(',').map(id => isNaN(id) ? id : parseInt(id));

                break;
            case 'object':
                try {
                    value = JSON.parse(decodeURIComponent(escape(window.atob(value))));
                } catch (e) {
                    value = undefined;
                }

                break;
            default:
                try {
                    value = JSON.parse(decodeURIComponent(escape(window.atob(value))));
                } catch (e) {
                    try {
                        value = JSON.parse(decodeURIComponent(escape(value)));
                    } catch (e) {}
                }

                break;
        }
    } else if (undefined !== value) {
        value = decodeURIComponent(value);
    }

    return value || defaultValue;
}

/**
 * Redirect if exist.
 *
 * @param {import('vue-router').Router} router The router
 *
 * @returns {Promise<Boolean>}
 */
export async function redirectIfExist(router) {
    if (router.currentRoute.query && router.currentRoute.query.redirect) {
        const redirect = Array.isArray(router.currentRoute.query.redirect)
            ? router.currentRoute.query.redirect[0]
            : router.currentRoute.query.redirect;

        if (redirect) {
            await router.replace(decodeURIComponent(cleanRedirect(redirect)));

            return true;
        }
    }

    return false;
}
