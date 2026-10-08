/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { describe, expect, it } from 'vitest';
import { fieldOperators, filterableFields, relationKindOf, resolveFieldPath } from '../utils/query-fields.js';

const field = (name, type, extra = {}) => ({
    name,
    type,
    label: name,
    searchable: true,
    filter_operators: ['='],
    ...extra,
});

const metadatas = {
    household: {
        name: 'household',
        fields: {
            id: field('id', 'integer'),
            name: field('name', 'char'),
            cover: field('cover', 'char', { searchable: false }),
            search_value: field('search_value', 'fulltext', { filter_operators: ['search'] }),
            initials: field('initials', 'computed', { filter_operators: [] }),
            owner: field('owner', 'many2one', { target: 'user', filter_operators: ['=', 'any'] }),
            workspace_users: field('workspace_users', 'one2many', {
                target: 'household_user',
                filter_operators: ['in'],
            }),
        },
    },
    household_user: {
        name: 'household_user',
        fields: { user: field('user', 'many2one', { target: 'user' }), role: field('role', 'choice') },
    },
    user: {
        name: 'user',
        fields: {
            id: field('id', 'integer', { filter_operators: ['=', '<', 'between'] }),
            email: field('email', 'email'),
        },
    },
};

describe('the fields a filter is built on', () => {
    it('leaves out the technical ones, the unfiltered ones and the excluded paths', () => {
        expect(filterableFields(metadatas.household).map((one) => one.name)).toEqual([
            'name',
            'owner',
            'workspace_users',
        ]);
        expect(filterableFields(metadatas.household, { exclude: ['owner'] }).map((one) => one.name)).toEqual([
            'name',
            'workspace_users',
        ]);
        expect(filterableFields(metadatas.user, { exclude: ['owner.email'], prefix: 'owner' })).toEqual([]);
    });

    it('walks a path through the relations, a relation and its key being one field', () => {
        const members = resolveFieldPath(metadatas, 'household', 'workspace_users.user.email');

        expect(members.path).toBe('workspace_users.user.email');
        expect(members.chain.map((link) => link.model)).toEqual(['household', 'household_user', 'user']);
        expect(members.field.type).toBe('email');

        expect(resolveFieldPath(metadatas, 'household', 'owner.id').path).toBe('owner');
        expect(resolveFieldPath(metadatas, 'household', 'owner.nope')).toBeNull();
        expect(resolveFieldPath(metadatas, 'household', '')).toBeNull();
    });

    it('offers on a relation the operators of its key', () => {
        expect(fieldOperators(metadatas, metadatas.household.fields.owner)).toEqual(['=', 'any', '<', 'between']);
        expect(fieldOperators(metadatas, metadatas.household.fields.name)).toEqual(['=']);
        expect(relationKindOf(metadatas.household.fields.workspace_users)).toBe('multiple');
        expect(relationKindOf(metadatas.household.fields.name)).toBeNull();
    });
});
