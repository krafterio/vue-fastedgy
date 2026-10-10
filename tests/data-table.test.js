/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick } from 'vue';
import { useDataTable } from '../composables/data-table.js';
import { bus } from '../composables/bus.js';
import { RESOURCES_STALE } from '../composables/realtime.js';

vi.mock('vue-router', () => ({
    useRoute: () => ({ query: {} }),
    useRouter: () => ({ replace: vi.fn() }),
}));

const held = vi.hoisted(() => ({
    metadatas: {
        invoice: {
            fields: {
                name: { type: 'char' },
                amount_due: { type: 'computed' },
            },
        },
    },
}));

vi.mock('../stores/metadata.js', () => ({
    useMetadataStore: () => ({
        getMetadata: () => Promise.resolve({}),
        getMetadatas: () => Promise.resolve(held.metadatas),
    }),
}));

const settle = async () => {
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve));
};

describe('useDataTable', () => {
    it('leaves a computed column out of the sort, which the server would ignore, unless the column says so', async () => {
        const service = {
            modelName: 'invoice',
            list: vi.fn().mockResolvedValue({ data: { items: [], total: 0 } }),
        };

        const table = useDataTable(service, {
            sortable: false,
            columns: [{ key: 'name' }, { key: 'amount_due' }, { key: 'amount_due', label: 'Due', sortable: true }],
        });

        await settle();

        expect(table.columns.value.map((column) => column.sortable)).toEqual([true, false, true]);
    });

    it('resolves its columns again from the metadata of the workspace it switches to', async () => {
        const service = {
            modelName: 'invoice',
            list: vi.fn().mockResolvedValue({ data: { items: [], total: 0 } }),
        };
        const scope = effectScope();
        const table = scope.run(() => useDataTable(service, { sortable: false, columns: [{ key: 'extra_level' }] }));

        await settle();
        expect(table.columns.value[0].type).toBeUndefined();

        held.metadatas = { invoice: { fields: { extra_level: { type: 'integer' } } } };
        bus.trigger(RESOURCES_STALE, { since: performance.now() });
        await settle();
        await settle();

        expect(table.columns.value[0]).toMatchObject({ type: 'integer', sortable: true });

        scope.stop();
    });
});
