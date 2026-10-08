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
 * `list` is the data iterator of the list: a view reads its expression and its
 * order, and is applied back to them. The methods reject what the server
 * refuses; showing it is the interface's business.
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
 * The view a list opens on, read before its first page: the favorite of the
 * current user, else the one of everyone, else none. Skipped when the list
 * already says what it shows (a link, a reload).
 *
 * @param {string} model - The metadata name of the listed model
 * @param {{ scope?: string, prefix?: string, skip?: boolean|(() => boolean) }} [options]
 * @returns {{ ready: import('vue').Ref<boolean>, view: import('vue').Ref<CustomView|null>, promise: Promise<void> }}
 */
export declare function useOpeningView(model: string, options?: {
    scope?: string;
    prefix?: string;
    skip?: boolean | (() => boolean);
}): {
    ready: import('vue').Ref<boolean>;
    view: import('vue').Ref<CustomView | null>;
    promise: Promise<void>;
};
//# sourceMappingURL=custom-views.d.ts.map