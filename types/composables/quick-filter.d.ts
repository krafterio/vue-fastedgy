export type QuickFilter = {
    /**
     * - Its key in `list.quick` and in the `qf` of the URL
     */
    name: string;
    /**
     * - Its value while the URL says nothing of it
     */
    default?: any;
    /**
     * - The rule a value stands for, `null` for none
     */
    filter: (value: any) => any;
};
/**
 * @typedef {Object} QuickFilter
 * @property {string} name - Its key in `list.quick` and in the `qf` of the URL
 * @property {any} [default] - Its value while the URL says nothing of it
 * @property {(value: any) => any} filter - The rule a value stands for, `null` for none
 */
/**
 * Read the quick filters of a URL, each at its default unless the URL says otherwise.
 *
 * @param {unknown} value - The `qf` of the URL
 * @param {Array<QuickFilter>} definitions
 * @returns {Record<string, any>}
 */
export declare function readQuickFilters(value: unknown, definitions: Array<QuickFilter>): Record<string, any>;
/**
 * The quick filters a URL keeps: those away from their default, `null` when none is.
 *
 * @param {Record<string, any>} values
 * @param {Array<QuickFilter>} definitions
 * @returns {string|null}
 */
export declare function writeQuickFilters(values: Record<string, any>, definitions: Array<QuickFilter>): string | null;
/**
 * The definition a quick filter is given as: itself, or the component made of it.
 *
 * @param {QuickFilter|{ quickFilter: QuickFilter }} one
 * @returns {QuickFilter}
 */
export declare const quickFilterOf: (one: QuickFilter | {
    quickFilter: QuickFilter;
}) => QuickFilter;
/**
 * Make a quick filter of any component speaking `v-model`: a switch, a
 * select, a date picker of the project. The component draws the value of the
 * quick filter in the list it is given, and changes it; the list reads the
 * definition before its first page, so the rule of a value the URL carries is
 * there from the first read.
 *
 * @param {QuickFilter} definition
 * @param {import('vue').Component} component - Speaks `modelValue` / `update:modelValue`
 * @param {Record<string, any>|(() => Record<string, any>)} [props] - Given to the component, read on each draw (a translated label stays in the language shown)
 * @returns {import('vue').Component & { quickFilter: QuickFilter }}
 *
 * @example
 * const ClosedTickets = defineQuickFilter(
 *     { name: 'closed', default: false, filter: (shown) => (shown ? null : ['status', '=', 'opened']) },
 *     SwitchField,
 *     () => ({ label: t('Tickets fermés') })
 * );
 *
 * useDataTable('support_ticket', { quickFilters: [ClosedTickets] });
 * // <ClosedTickets :list="list" />
 */
export declare function defineQuickFilter(definition: QuickFilter, component: import('vue').Component, props?: Record<string, any> | (() => Record<string, any>)): import('vue').Component & {
    quickFilter: QuickFilter;
};
//# sourceMappingURL=quick-filter.d.ts.map