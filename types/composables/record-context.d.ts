/**
 * The list a record is opened from, carried by the query of its route so a
 * reload keeps it: the filter the list sends, or the one of the group the
 * record is opened from, and its order.
 *
 * @param {{ combinedFilter: import('vue').Ref<any>, orderBy: import('vue').Ref<Array<string>|null> }} list - A data iterator
 * @param {{ group?: { filter: any }|null }} [options] - The group of a grouped list the record is opened from
 * @returns {{ ctx?: string }} Nothing for a list neither filtered nor ordered: an empty context stays out of the url
 */
export declare function listContext(list: {
    combinedFilter: import('vue').Ref<any>;
    orderBy: import('vue').Ref<Array<string> | null>;
}, { group }?: {
    group?: {
        filter: any;
    } | null;
}): {
    ctx?: string;
};
/**
 * The records before and after the one a route shows, in the list it was
 * opened from. The server computes them on the same query as the list, so
 * they hold after a reload; stepping replaces the history entry, so going
 * back returns to the list rather than to each record seen.
 *
 * A record shown from its list without a context in its query is in the list
 * as it comes, unfiltered and in its default order: `listed` says when.
 *
 * @param {any} api - The api model of the record (useXxxApiModel())
 * @param {{ routeName: string, param?: string, listed?: boolean|(() => boolean) }} options - The route of a record, its id parameter, and whether it is shown from its list when its query carries no context
 * @returns {Object}
 */
export declare function useRecordContext(api: any, { routeName, param, listed }: {
    routeName: string;
    param?: string;
    listed?: boolean | (() => boolean);
}): any;
//# sourceMappingURL=record-context.d.ts.map