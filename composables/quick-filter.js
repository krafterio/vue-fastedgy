/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { h, markRaw, toValue } from 'vue';

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
export function readQuickFilters(value, definitions) {
    let given = {};

    try {
        given = typeof value === 'string' && value !== '' ? JSON.parse(value) : {};
    } catch {
        given = {};
    }

    const read = given !== null && typeof given === 'object' && !Array.isArray(given) ? given : {};

    return Object.fromEntries(
        definitions.map((one) => [one.name, Object.hasOwn(read, one.name) ? read[one.name] : (one.default ?? null)])
    );
}

/**
 * The quick filters a URL keeps: those away from their default, `null` when none is.
 *
 * @param {Record<string, any>} values
 * @param {Array<QuickFilter>} definitions
 * @returns {string|null}
 */
export function writeQuickFilters(values, definitions) {
    const moved = definitions.filter(
        (one) => JSON.stringify(values[one.name] ?? null) !== JSON.stringify(one.default ?? null)
    );

    return moved.length > 0
        ? JSON.stringify(Object.fromEntries(moved.map((one) => [one.name, values[one.name]])))
        : null;
}

/**
 * The definition a quick filter is given as: itself, or the component made of it.
 *
 * @param {QuickFilter|{ quickFilter: QuickFilter }} one
 * @returns {QuickFilter}
 */
export const quickFilterOf = (one) => /** @type {any} */ (one).quickFilter ?? one;

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
export function defineQuickFilter(definition, component, props = {}) {
    return markRaw({
        name: 'QuickFilter',
        quickFilter: definition,
        props: { list: { type: Object, required: true } },
        setup(own) {
            return () =>
                h(component, {
                    ...toValue(props),
                    modelValue: own.list.quick[definition.name],
                    'onUpdate:modelValue': (value) => {
                        own.list.quick[definition.name] = value;
                    },
                });
        },
    });
}
