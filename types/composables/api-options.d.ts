/**
 * The records a field offers to choose from: a page at a time, searched, and
 * the one already chosen read back by its id.
 *
 * A picker shows a handful of fields and holds an id: this reads exactly those
 * fields, continues the list as it is scrolled, and resolves the value it was
 * given so the closed field has something to show.
 *
 * @param {string|object} model - Model name: metadata 'name' or 'api_name', or an api model
 * @param {{fields?: string[], filter?: Array|function(): Array, limit?: number,
 *          minSearchLength?: number, searchFilter?: function(string): Array,
 *          params?: object, query?: object|function(): object}} [options]
 *
 * @returns {{items: import("vue").Ref<Array>, loading: import("vue").Ref<boolean>,
 *            hasMore: import("vue").Ref<boolean>, total: import("vue").Ref<number>,
 *            search: (function(string): Promise<void>), loadMore: (function(): Promise<void>),
 *            refresh: (function(): Promise<void>), resolve: (function(string|number): Promise<any>)}}
 *
 * @example
 * const { items, search, loadMore } = useApiOptions('plant_template', {
 *     fields: ['name', 'image'],
 *     searchFilter: (text) => ['name', 'icontains', text],
 * });
 */
export declare function useApiOptions(model: string | object, options?: {
    fields?: string[];
    filter?: any[] | Function;
    (): any[];
    limit?: number;
    minSearchLength?: number;
    searchFilter?: Function;
    (string: any): any[];
    params?: object;
    query?: object | Function;
    (): object;
}): {
    items: import("vue").Ref<any[]>;
    loading: import("vue").Ref<boolean>;
    hasMore: import("vue").Ref<boolean>;
    total: import("vue").Ref<number>;
    search: (Function);
    (string: any): Promise<void>;
};
//# sourceMappingURL=api-options.d.ts.map