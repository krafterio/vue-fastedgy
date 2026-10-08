export type QueryJoint = '&' | '|';
export type QueryGroup = {
    id: number;
    kind: 'group';
    joint: QueryJoint;
    children: Array<QueryNode>;
};
export type QueryRule = {
    id: number;
    kind: 'rule';
    field: string;
    operator: string;
    value?: any;
};
export type QueryAnyBlock = {
    id: number;
    kind: 'any';
    field: string;
    negated: boolean;
    group: QueryGroup;
};
export type QueryOpaque = {
    id: number;
    kind: 'opaque';
    raw: any;
};
export type QueryNode = QueryGroup | QueryRule | QueryAnyBlock | QueryOpaque;
/**
 * How many values an operator takes: none, one, two (a range), a list, or a
 * sub-filter on the related model.
 *
 * @param {string} operator
 * @returns {'none'|'one'|'two'|'list'|'sub'}
 */
export declare function arityOf(operator: string): 'none' | 'one' | 'two' | 'list' | 'sub';
/**
 * @param {QueryJoint} [joint]
 * @param {Array<QueryNode>} [children]
 * @returns {QueryGroup}
 */
export declare function createGroup(joint?: QueryJoint, children?: Array<QueryNode>): QueryGroup;
/**
 * @param {string} [field]
 * @param {string} [operator]
 * @param {any} [value]
 * @returns {QueryRule}
 */
export declare function createRule(field?: string, operator?: string, value?: any): QueryRule;
/**
 * @param {string} field
 * @param {boolean} [negated]
 * @param {QueryGroup} [group]
 * @returns {QueryAnyBlock}
 */
export declare function createAnyBlock(field: string, negated?: boolean, group?: QueryGroup): QueryAnyBlock;
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
export declare function parseExpression(expression: any): QueryGroup;
/**
 * Write the tree back as an `X-Filter` expression, or `null` when nothing
 * filters. An incomplete rule is left out, a group of one item is that item,
 * and the only form written is `[joint, [items]]`.
 *
 * @param {QueryGroup} tree
 * @returns {any}
 */
export declare function serializeExpression(tree: QueryGroup): any;
/**
 * The conditions a tree applies: its complete rules and its blocks, a block
 * counting one whatever it holds. A rule written as is, unread, counts too.
 *
 * @param {QueryGroup} tree
 * @returns {number}
 */
export declare function countConditions(tree: QueryGroup): number;
/**
 * Whether two expressions say the same, once read and written back.
 *
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 */
export declare function sameExpression(a: any, b: any): boolean;
/**
 * The node of a tree carrying an id, with its parent group.
 *
 * @param {QueryGroup} tree
 * @param {number} id
 * @returns {{ node: QueryNode, parent: QueryGroup|null }|null}
 */
export declare function findQueryNode(tree: QueryGroup, id: number): {
    node: QueryNode;
    parent: QueryGroup | null;
} | null;
//# sourceMappingURL=query-expression.d.ts.map