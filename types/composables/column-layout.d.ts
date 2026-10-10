/**
 * The width of a column that says none: it keeps its own.
 *
 * @type {number}
 */
export declare const defaultColumnWidth: number;
/**
 * The widths a column offers, by their label.
 *
 * @type {Array<{ label: string, width: number }>}
 */
export declare const columnWidths: Array<{
    label: string;
    width: number;
}>;
export type ColumnEntry = {
    /**
     * - The field of the column
     */
    name: string;
    /**
     * - Its width, null for the default one
     */
    width: number | null;
};
/**
 * @typedef {Object} ColumnEntry
 * @property {string} name - The field of the column
 * @property {number|null} width - Its width, null for the default one
 */
/**
 * An entry as `display_fields` keeps it, read: a name, or a name and a width.
 *
 * @param {unknown} raw
 * @returns {ColumnEntry|null} - Null for what names no column
 */
export declare function readColumnEntry(raw: unknown): ColumnEntry | null;
/**
 * A column as `display_fields` keeps it: its name, or its name and its width
 * when it is not the default one.
 *
 * @param {string} name
 * @param {number|null} [width]
 * @returns {string|{ name: string, width: number }}
 */
export declare function columnEntry(name: string, width?: number | null): string | {
    name: string;
    width: number;
};
/**
 * The columns a list shows, their order and their width: those of the user,
 * else those of everyone, else the columns declared.
 *
 * A change shows at once and is written once the changes of a moment are over,
 * as a custom view without filters of the scope `layout` (`layout:<scope>`),
 * which no menu of views lists. On a view that carries its columns, a change is
 * one of the view instead. Given the list it lays out (`table`), its views save
 * and show the columns (`display_fields`), and a data table shows them.
 *
 * A `store` keeps the layout somewhere else, the columns of a record for one:
 * it reads and writes the entries as `display_fields` keeps them, and nothing
 * is shared.
 *
 * @param {string|object} model - Model name or an api model (useXxxApiModel())
 * @param {Object} [options]
 * @param {string} [options.scope] - The list among those of the model, `''` for its default one
 * @param {string} [options.prefix] - Where the custom views are read, where the api model answers otherwise
 * @param {Array<string|object>|Function|import('vue').Ref} [options.declared] - The columns shown when no layout says
 *   otherwise, as `display_fields` keeps them
 * @param {Array<string>} [options.locked] - The columns that move, but are neither removed nor resized; put back first
 *   when a layout leaves them out
 * @param {Array<string>} [options.exclude] - The fields never offered
 * @param {{ read: () => Promise<Array|null>, write: (entries: Array) => Promise<void> }} [options.store] - Where the
 *   layout is kept in place of the custom views
 * @param {number} [options.delay] - How long the changes of a moment wait before they are written (default: 500 ms)
 * @param {Object} [options.table] - The data iterator or data table the layout is for
 * @returns {Object}
 *
 * @example
 * const list = useDataIterator(useFlowApiModel(), { views: { scope: '' } });
 * const layout = useColumnLayout(useFlowApiModel(), {
 *     table: list,
 *     declared: ['status', 'due_date'],
 *     locked: ['name'],
 * });
 *
 * layout.show('priority');
 */
export declare function useColumnLayout(model: string | object, options?: {
    scope?: string;
    prefix?: string;
    declared?: Array<string | object> | Function | import('vue').Ref;
    locked?: Array<string>;
    exclude?: Array<string>;
    store?: {
        read: () => Promise<any[] | null>;
        write: (entries: any[]) => Promise<void>;
    };
    delay?: number;
    table?: any;
}): any;
//# sourceMappingURL=column-layout.d.ts.map