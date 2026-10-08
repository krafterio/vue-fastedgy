/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

/**
 * @typedef {'&'|'|'} QueryJoint
 *
 * @typedef {Object} QueryGroup
 * @property {number} id
 * @property {'group'} kind
 * @property {QueryJoint} joint
 * @property {Array<QueryNode>} children
 *
 * @typedef {Object} QueryRule
 * @property {number} id
 * @property {'rule'} kind
 * @property {string} field
 * @property {string} operator
 * @property {any} [value]
 *
 * @typedef {Object} QueryAnyBlock
 * @property {number} id
 * @property {'any'} kind
 * @property {string} field
 * @property {boolean} negated
 * @property {QueryGroup} group
 *
 * @typedef {Object} QueryOpaque
 * @property {number} id
 * @property {'opaque'} kind
 * @property {any} raw
 *
 * @typedef {QueryGroup|QueryRule|QueryAnyBlock|QueryOpaque} QueryNode
 */

const JOINTS = ['&', '|'];

const ARITIES = {
    'is empty': 'none',
    'is not empty': 'none',
    'is true': 'none',
    'is false': 'none',
    between: 'two',
    in: 'list',
    'not in': 'list',
    any: 'sub',
    'not any': 'sub',
};

let lastId = 0;

const nextId = () => ++lastId;

/**
 * How many values an operator takes: none, one, two (a range), a list, or a
 * sub-filter on the related model.
 *
 * @param {string} operator
 * @returns {'none'|'one'|'two'|'list'|'sub'}
 */
export function arityOf(operator) {
    return ARITIES[operator] ?? 'one';
}

/**
 * @param {QueryJoint} [joint]
 * @param {Array<QueryNode>} [children]
 * @returns {QueryGroup}
 */
export function createGroup(joint = '&', children = []) {
    return { id: nextId(), kind: 'group', joint, children };
}

/**
 * @param {string} [field]
 * @param {string} [operator]
 * @param {any} [value]
 * @returns {QueryRule}
 */
export function createRule(field = '', operator = '', value) {
    return { id: nextId(), kind: 'rule', field, operator, value };
}

/**
 * @param {string} field
 * @param {boolean} [negated]
 * @param {QueryGroup} [group]
 * @returns {QueryAnyBlock}
 */
export function createAnyBlock(field, negated = false, group = createGroup()) {
    return { id: nextId(), kind: 'any', field, negated, group };
}

const isGroupForm = (item) =>
    Array.isArray(item) && item.length === 2 && JOINTS.includes(item[0]) && Array.isArray(item[1]);

const isFlatForm = (item) =>
    Array.isArray(item) && item.length > 1 && JOINTS.includes(item[0]) && item.slice(1).every(Array.isArray);

const isRuleForm = (item) =>
    Array.isArray(item) &&
    (item.length === 2 || item.length === 3) &&
    typeof item[0] === 'string' &&
    typeof item[1] === 'string';

const isListForm = (item) => Array.isArray(item) && item.length > 0 && item.every(Array.isArray);

function asGroup(node) {
    return node.kind === 'group' ? node : createGroup('&', [node]);
}

function readNode(item) {
    if (isGroupForm(item)) {
        return createGroup(item[0], item[1].map(readNode));
    }

    if (isFlatForm(item)) {
        return createGroup(item[0], item.slice(1).map(readNode));
    }

    if (isRuleForm(item)) {
        if (arityOf(item[1]) === 'sub') {
            const sub = item.length === 3 && item[2] !== null ? asGroup(readNode(item[2])) : createGroup();

            return createAnyBlock(item[0], item[1] === 'not any', sub);
        }

        return createRule(item[0], item[1], item.length === 3 ? item[2] : undefined);
    }

    if (isListForm(item)) {
        return createGroup('&', item.map(readNode));
    }

    return { id: nextId(), kind: 'opaque', raw: item };
}

/**
 * Read an `X-Filter` expression into the tree the query builder edits.
 *
 * Every form the server accepts reads: a rule, a group, the flat form
 * `['|', r1, r2]`, a list (all of them), a block on a relation. The root is
 * always a group; nothing is a root of its own.
 *
 * @param {any} expression
 * @returns {QueryGroup}
 */
export function parseExpression(expression) {
    if (expression === null || expression === undefined || (Array.isArray(expression) && expression.length === 0)) {
        return createGroup();
    }

    return asGroup(readNode(expression));
}

const isBlank = (value) =>
    value === undefined || value === null || value === '' || (typeof value === 'number' && Number.isNaN(value));

const keyOf = (value) => (value !== null && typeof value === 'object' && !Array.isArray(value) ? value.id : value);

function writeRule(rule) {
    if (!rule.field || !rule.operator) {
        return null;
    }

    const arity = arityOf(rule.operator);

    if (arity === 'none') {
        return [rule.field, rule.operator];
    }

    if (arity === 'list') {
        const values = (Array.isArray(rule.value) ? rule.value : [rule.value]).map(keyOf).filter((v) => !isBlank(v));

        return values.length > 0 ? [rule.field, rule.operator, values] : null;
    }

    if (arity === 'two') {
        const range = Array.isArray(rule.value) ? rule.value.map(keyOf) : [];

        return range.length === 2 && !range.some(isBlank) ? [rule.field, rule.operator, range] : null;
    }

    const value = keyOf(rule.value);

    return isBlank(value) ? null : [rule.field, rule.operator, value];
}

function writeGroup(group) {
    const items = group.children.map(writeNode).filter((item) => item !== null);

    if (items.length === 0) {
        return null;
    }

    return items.length === 1 ? items[0] : [group.joint, items];
}

function writeNode(node) {
    switch (node.kind) {
        case 'group':
            return writeGroup(node);
        case 'rule':
            return writeRule(node);
        case 'any':
            return node.field ? [node.field, node.negated ? 'not any' : 'any', writeGroup(node.group)] : null;
        default:
            return node.raw ?? null;
    }
}

/**
 * Write the tree back as an `X-Filter` expression, or `null` when nothing
 * filters. An incomplete rule is left out, a group of one item is that item,
 * and the only form written is `[joint, [items]]`.
 *
 * @param {QueryGroup} tree
 * @returns {any}
 */
export function serializeExpression(tree) {
    return tree ? writeGroup(tree) : null;
}

function countNode(node) {
    switch (node.kind) {
        case 'group':
            return node.children.reduce((total, child) => total + countNode(child), 0);
        case 'rule':
            return writeRule(node) === null ? 0 : 1;
        case 'any':
            return node.field ? 1 : 0;
        default:
            return 1;
    }
}

/**
 * The conditions a tree applies: its complete rules and its blocks, a block
 * counting one whatever it holds. A rule written as is, unread, counts too.
 *
 * @param {QueryGroup} tree
 * @returns {number}
 */
export function countConditions(tree) {
    return tree ? countNode(tree) : 0;
}

/**
 * Whether two expressions say the same, once read and written back.
 *
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 */
export function sameExpression(a, b) {
    return (
        JSON.stringify(serializeExpression(parseExpression(a))) ===
        JSON.stringify(serializeExpression(parseExpression(b)))
    );
}

/**
 * The node of a tree carrying an id, with its parent group.
 *
 * @param {QueryGroup} tree
 * @param {number} id
 * @returns {{ node: QueryNode, parent: QueryGroup|null }|null}
 */
export function findQueryNode(tree, id) {
    const visit = (node, parent) => {
        if (node.id === id) {
            return { node, parent };
        }

        const children = node.kind === 'group' ? node.children : node.kind === 'any' ? [node.group] : [];

        for (const child of children) {
            const found = visit(child, node.kind === 'group' ? node : null);

            if (found) {
                return found;
            }
        }

        return null;
    };

    return tree ? visit(tree, null) : null;
}
