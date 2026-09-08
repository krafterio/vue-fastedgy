/**
 * The ordering of a list, as the server reads it: `field:direction`, several of
 * them separated by a comma. A direction left out is ascending.
 */
/**
 * Read an ordering written as one string, a url query for instance.
 *
 * @param {String|null} value - e.g. 'name:asc,created_at:desc'
 * @returns {Array<String>|null}
 */
export declare function parseOrderBy(value: string | null): Array<string> | null;
/**
 * Write an ordering as one string, to put it back in a url.
 *
 * @param {Array<String>|null} terms
 * @returns {String|null}
 */
export declare function formatOrderBy(terms: Array<string> | null): string | null;
/**
 * The field an ordering term names, and the direction it asks for.
 *
 * @param {String} term - e.g. 'name:desc'
 * @returns {{field: String, direction: String}}
 */
export declare function orderByTerm(term: string): {
    field: string;
    direction: string;
};
//# sourceMappingURL=order-by.d.ts.map