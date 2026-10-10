export type CustomView = {
    id: number;
    name: string;
    model: string;
    scope: string;
    user: {
        id: number;
    } | null;
    filters: any;
    order_by: Array<string> | null;
    group_by: string | null;
    display_fields: Array<any> | null;
    sequence: number;
    is_default: boolean;
    editable: boolean;
};
/**
 * The custom views of a list: read once the menu opens, applied to the list,
 * saved from what it shows.
 *
 * `list` is the data iterator of the list: a view reads its expression, its
 * order and its grouping, and is applied back to them. The methods reject
 * what the server refuses; showing it is the interface's business.
 *
 * @param {string} model - The metadata name of the listed model
 * @param {{ scope?: string, prefix?: string, list?: any }} [options]
 * @returns {Object}
 */
export declare function useCustomViews(model: string, options?: {
    scope?: string;
    prefix?: string;
    list?: any;
}): any;
/**
 * The view a list opens on, read before its first page: the one a link names
 * (`id`), else the favorite of the current user, else the one of everyone,
 * else none. A view named by a link is kept only if it is one of this list.
 * Skipped when the list already says what it shows (a reload).
 *
 * @param {string} model - The metadata name of the listed model
 * @param {{ scope?: string, prefix?: string, skip?: boolean|(() => boolean), id?: number|null }} [options]
 * @returns {{ ready: import('vue').Ref<boolean>, view: import('vue').Ref<CustomView|null>, promise: Promise<void> }}
 */
export declare function useOpeningView(model: string, options?: {
    scope?: string;
    prefix?: string;
    skip?: boolean | (() => boolean);
    id?: number | null;
}): {
    ready: import('vue').Ref<boolean>;
    view: import('vue').Ref<CustomView | null>;
    promise: Promise<void>;
};
//# sourceMappingURL=custom-views.d.ts.map