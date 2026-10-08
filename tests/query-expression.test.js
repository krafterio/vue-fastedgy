/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { describe, expect, it } from 'vitest';
import { nextTick, ref } from 'vue';
import { useQueryExpression } from '../composables/query-expression.js';
import {
    arityOf,
    countConditions,
    createAnyBlock,
    createGroup,
    createRule,
    parseExpression,
    sameExpression,
    serializeExpression,
} from '../utils/query-expression.js';
import corpus from './fixtures/expressions.json';

describe('the expression corpus shared with fastedgy', () => {
    it.each(corpus.cases)('writes back $name', ({ input, output }) => {
        expect(serializeExpression(parseExpression(input))).toEqual(output);
    });
});

describe('writing a tree', () => {
    it('leaves out what is incomplete, and the groups it empties', () => {
        const tree = createGroup('&', [
            createRule('name', 'icontains', ''),
            createRule('', 'in', [1]),
            createRule('price', 'between', [10, null]),
            createRule('quantity', 'in', []),
            createGroup('|', [createRule('name')]),
            createRule('rating', 'is empty'),
        ]);

        expect(serializeExpression(tree)).toEqual(['rating', 'is empty']);
        expect(countConditions(tree)).toBe(1);
    });

    it('writes a list for in, and the keys of the related records', () => {
        const tree = createGroup('&', [createRule('category', 'in', { id: 2 }), createRule('owner', '=', { id: 7 })]);

        expect(serializeExpression(tree)).toEqual([
            '&',
            [
                ['category', 'in', [2]],
                ['owner', '=', 7],
            ],
        ]);
    });

    it('counts a block once whatever it holds, and a rule it cannot read', () => {
        const tree = parseExpression([
            '&',
            [
                [
                    'tags',
                    'any',
                    [
                        '|',
                        [
                            ['name', '=', 'a'],
                            ['name', '=', 'b'],
                        ],
                    ],
                ],
                ['secret', 'like', '%x%'],
            ],
        ]);

        expect(countConditions(tree)).toBe(2);
    });

    it('says two expressions are the same when they read alike', () => {
        expect(
            sameExpression(
                ['|', ['a', '=', 1], ['b', '=', 2]],
                [
                    '|',
                    [
                        ['a', '=', 1],
                        ['b', '=', 2],
                    ],
                ]
            )
        ).toBe(true);
        expect(sameExpression([['a', '=', 1]], ['a', '=', 1])).toBe(true);
        expect(sameExpression(['a', '=', 1], ['a', '=', 2])).toBe(false);
        expect(sameExpression(null, [])).toBe(true);
    });

    it('knows how many values an operator takes', () => {
        expect(['is empty', '=', 'between', 'not in', 'not any'].map(arityOf)).toEqual([
            'none',
            'one',
            'two',
            'list',
            'sub',
        ]);
    });
});

describe('useQueryExpression', () => {
    it('edits the tree and writes the expression it says', () => {
        const query = useQueryExpression(null);
        const root = query.tree.value.id;

        const rule = query.addRule(root, { field: 'name', operator: 'icontains', value: 'lap' });
        const group = query.addGroup(root, '|');
        query.addRule(group, { field: 'quantity', operator: '>', value: 3 });
        query.addRule(group, { field: 'is_active', operator: 'is true' });

        expect(query.expression.value).toEqual([
            '&',
            [
                ['name', 'icontains', 'lap'],
                [
                    '|',
                    [
                        ['quantity', '>', 3],
                        ['is_active', 'is true'],
                    ],
                ],
            ],
        ]);
        expect(query.count.value).toBe(3);

        query.setJoint(root, '|');
        query.remove(group);
        query.replace(rule, createAnyBlock('tags'));

        expect(query.expression.value).toEqual(['tags', 'any', null]);
    });

    it('keeps the row being typed when its own expression comes back, and reads a new one', async () => {
        const source = ref(['name', '=', 'Novel']);
        const query = useQueryExpression(source);
        const root = query.tree.value.id;

        query.addRule(root);
        source.value = query.expression.value;
        await nextTick();

        expect(query.tree.value.children).toHaveLength(2);

        source.value = ['quantity', '>', 0];
        await nextTick();

        expect(query.tree.value.children.map((node) => node.field)).toEqual(['quantity']);
    });

    it('clears and loads', () => {
        const query = useQueryExpression(['a', '=', 1]);

        query.clear();
        expect(query.expression.value).toBeNull();

        query.load([
            '|',
            [
                ['a', '=', 1],
                ['b', '=', 2],
            ],
        ]);
        expect(query.count.value).toBe(2);
    });
});
