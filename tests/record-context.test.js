/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { listContext, useRecordContext } from '../composables/record-context.js';

const router = vi.hoisted(() => ({ route: { params: {}, query: {} }, replace: vi.fn() }));
const siblings = vi.hoisted(() => ({ calls: [] }));

vi.mock('vue-router', () => ({
    useRoute: () => router.route,
    useRouter: () => ({ replace: router.replace }),
}));

vi.mock('../composables/realtime.js', async () => {
    const { ref: makeRef } = await import('vue');

    return {
        useApiSiblings: (model, id, query, options) => {
            siblings.calls.push({ model, id: id(), query: query(), options });

            return { previous: makeRef(3), next: makeRef(8), status: makeRef('success'), error: makeRef(null) };
        },
    };
});

describe('the list a record is opened from', () => {
    it('travels in the query of the record route', () => {
        const list = { combinedFilter: ref([['is_active', 'is true']]), orderBy: ref(['name:asc']) };

        expect(JSON.parse(listContext(list).ctx)).toEqual({ f: [['is_active', 'is true']], o: ['name:asc'] });
        expect(JSON.parse(listContext({ combinedFilter: ref(null), orderBy: ref(null) }).ctx)).toEqual({});
    });

    it('carries the filter of the group a record is opened from', () => {
        const list = { combinedFilter: ref([['is_active', 'is true']]), orderBy: ref(['sequence:asc']) };
        const group = { filter: ['&', [[['is_active', 'is true']], ['stage', '=', 2]]] };

        expect(JSON.parse(listContext(list, { group }).ctx)).toEqual({ f: group.filter, o: ['sequence:asc'] });
    });

    it('gives the neighbours of the record in that list, and steps without stacking the history', () => {
        router.route = {
            params: { id: '5' },
            query: { ctx: JSON.stringify({ f: [['is_active', 'is true']], o: ['name:asc'] }) },
        };
        const api = { modelName: 'support_ticket' };

        const record = useRecordContext(api, { routeName: 'support-ticket' });

        expect(siblings.calls.at(-1)).toMatchObject({
            model: 'support_ticket',
            id: '5',
            query: { filter: [['is_active', 'is true']], orderBy: ['name:asc'] },
        });
        expect(record.inList.value).toBe(true);
        expect(record.next.value).toBe(8);

        record.go(8);

        expect(router.replace).toHaveBeenCalledWith({
            name: 'support-ticket',
            params: { id: 8 },
            query: router.route.query,
        });
    });

    it('asks for nothing when the record was not opened from a list', () => {
        router.route = { params: { id: '5' }, query: {} };

        const record = useRecordContext({ modelName: 'support_ticket' }, { routeName: 'support-ticket' });

        expect(siblings.calls.at(-1).id).toBeNull();
        expect(record.inList.value).toBe(false);
    });
});
