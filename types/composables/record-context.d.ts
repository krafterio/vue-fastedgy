/**
 * The list a record is opened from, carried by the query of its route so a
 * reload keeps it: the filter the list sends and its order.
 *
 * @param {{ combinedFilter: import('vue').Ref<any>, orderBy: import('vue').Ref<Array<string>|null> }} list - A data iterator
 * @returns {{ ctx: string }}
 */
export declare function listContext(list: {
    combinedFilter: import('vue').Ref<any>;
    orderBy: import('vue').Ref<Array<string> | null>;
}): {
    ctx: string;
};
/**
 * The records before and after the one a route shows, in the list it was
 * opened from. The server computes them on the same query as the list, so
 * they hold after a reload; stepping replaces the history entry, so going
 * back returns to the list rather than to each record seen.
 *
 * @param {any} api - The api model of the record (useXxxApiModel())
 * @param {{ routeName: string, param?: string }} options - The route of a record, and its id parameter
 * @returns {Object}
 */
export declare function useRecordContext(api: any, { routeName, param }: {
    routeName: string;
    param?: string;
}): any;
//# sourceMappingURL=record-context.d.ts.map