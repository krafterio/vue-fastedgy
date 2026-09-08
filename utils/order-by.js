/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

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
export function parseOrderBy(value) {
    if (!value) {
        return null;
    }

    return String(value)
        .split(',')
        .map((term) => term.trim())
        .filter(Boolean);
}

/**
 * Write an ordering as one string, to put it back in a url.
 *
 * @param {Array<String>|null} terms
 * @returns {String|null}
 */
export function formatOrderBy(terms) {
    if (!terms || terms.length === 0) {
        return null;
    }

    return terms.join(',');
}

/**
 * The field an ordering term names, and the direction it asks for.
 *
 * @param {String} term - e.g. 'name:desc'
 * @returns {{field: String, direction: String}}
 */
export function orderByTerm(term) {
    const [field, direction = 'asc'] = String(term ?? '').split(':');

    return { field, direction };
}
