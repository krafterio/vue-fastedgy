import { useRouter } from "vue-router";

/**
 * Advanced navigation helper with smart back/forward detection
 */
export function useNavigator() {
    const router = useRouter();

    /**
     * Navigate back if the previous route matches the target, otherwise push to target
     * Preserves query params, scroll position, and page state when going back
     *
     * @param {string|Object} target - Route name (string) or route location object { name, params }
     * @returns {Promise<void>}
     *
     * @example
     * goBackTo('Users')
     * goBackTo({ name: 'User', params: { id: '123' } })
     */
    const goBackTo = (target) => {
        const targetLocation =
            typeof target === "string" ? { name: target } : target;

        const previousPath = router.options.history.state.back;

        if (previousPath && routesMatch(previousPath, targetLocation)) {
            return router.back();
        }

        return router.push(targetLocation);
    };

    /**
     * Navigate forward if the next route matches the target, otherwise push to target
     * Useful for "redo" or "continue" actions
     *
     * @param {string|Object} target - Route name (string) or route location object { name, params }
     * @returns {Promise<void>}
     *
     * @example
     * goNextTo('UserEdit')
     * goNextTo({ name: 'User', params: { id: '456' } })
     */
    const goNextTo = (target) => {
        const targetLocation =
            typeof target === "string" ? { name: target } : target;

        const nextPath = router.options.history.state.forward;

        if (nextPath && routesMatch(nextPath, targetLocation)) {
            return router.forward();
        }

        return router.push(targetLocation);
    };

    /**
     * Simple back navigation (wrapper for router.back())
     * @returns {void}
     */
    const goBack = () => {
        router.back();
    };

    /**
     * Simple forward navigation (wrapper for router.forward())
     * @returns {void}
     */
    const goNext = () => {
        router.forward();
    };

    /**
     * Check if a history path matches a target route location
     * Compares route names and params (ignores query params)
     */
    const routesMatch = (historyPath, targetLocation) => {
        const historyRoute = router.resolve(historyPath);
        const targetRoute = router.resolve(targetLocation);

        const isSameRoute = historyRoute.name === targetRoute.name;
        const hasSameParams = compareParams(
            historyRoute.params,
            targetRoute.params
        );

        return isSameRoute && hasSameParams;
    };

    /**
     * Compare two params objects for equality
     */
    const compareParams = (params1, params2) => {
        const keys1 = Object.keys(params1 || {});
        const keys2 = Object.keys(params2 || {});

        if (keys1.length !== keys2.length) {
            return false;
        }

        return keys1.every((key) => params1[key] === params2[key]);
    };

    return {
        goBackTo,
        goNextTo,
        goBack,
        goNext,
    };
}
