/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { computed, ref, toValue, watch } from 'vue';
import {
    countConditions,
    createAnyBlock,
    createGroup,
    createRule,
    findQueryNode,
    parseExpression,
    sameExpression,
    serializeExpression,
} from '../utils/query-expression.js';

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
export function useQueryExpression(source = null) {
    const tree = ref(parseExpression(toValue(source)));
    const expression = computed(() => serializeExpression(tree.value));
    const count = computed(() => countConditions(tree.value));

    watch(
        () => JSON.stringify(toValue(source) ?? null),
        (next) => {
            const incoming = JSON.parse(next);

            if (!sameExpression(incoming, expression.value)) {
                tree.value = parseExpression(incoming);
            }
        }
    );

    const groupOf = (id) => {
        const found = findQueryNode(tree.value, id);

        return found && found.node.kind === 'group' ? found.node : null;
    };

    /**
     * @param {number} groupId
     * @param {import('../utils/query-expression.js').QueryNode} node
     * @returns {number|null}
     */
    const append = (groupId, node) => {
        const group = groupOf(groupId);

        if (!group) {
            return null;
        }

        group.children.push(node);

        return node.id;
    };

    return {
        tree,
        expression,
        count,

        /** @param {number} groupId @param {{ field?: string, operator?: string, value?: any }} [rule] */
        addRule: (groupId, rule = {}) => append(groupId, createRule(rule.field, rule.operator, rule.value)),

        /** @param {number} groupId @param {'&'|'|'} [joint] */
        addGroup: (groupId, joint = '&') => append(groupId, createGroup(joint)),

        /** @param {number} groupId @param {string} field @param {boolean} [negated] */
        addAny: (groupId, field, negated = false) => append(groupId, createAnyBlock(field, negated)),

        /**
         * @param {number} nodeId
         * @param {Record<string, any>} patch
         */
        update: (nodeId, patch) => {
            const found = findQueryNode(tree.value, nodeId);

            if (found) {
                Object.assign(found.node, patch);
            }
        },

        /**
         * Put another node in the place of one, a rule turning into a block or back.
         *
         * @param {number} nodeId
         * @param {import('../utils/query-expression.js').QueryNode} node
         */
        replace: (nodeId, node) => {
            const found = findQueryNode(tree.value, nodeId);

            if (found?.parent) {
                found.parent.children.splice(found.parent.children.indexOf(found.node), 1, node);
            }
        },

        /** @param {number} groupId @param {'&'|'|'} joint */
        setJoint: (groupId, joint) => {
            const group = groupOf(groupId);

            if (group) {
                group.joint = joint;
            }
        },

        /** @param {number} nodeId */
        remove: (nodeId) => {
            const found = findQueryNode(tree.value, nodeId);

            if (found?.parent) {
                found.parent.children.splice(found.parent.children.indexOf(found.node), 1);
            }
        },

        clear: () => {
            tree.value = createGroup();
        },

        /** @param {any} next */
        load: (next) => {
            tree.value = parseExpression(next);
        },
    };
}
