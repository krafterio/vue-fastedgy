/**
 * The tree of a query builder over an expression held elsewhere.
 *
 * The tree is read again when the expression it is given changes meaning, and
 * not when it comes back saying what the tree just wrote: rebuilding on its own
 * echo would drop the row being typed, which writes nothing yet.
 *
 * @param {import('vue').MaybeRefOrGetter<any>} [source] - The expression to edit
 * @returns {Object}
 */
export declare function useQueryExpression(source?: import('vue').MaybeRefOrGetter<any>): any;
//# sourceMappingURL=query-expression.d.ts.map