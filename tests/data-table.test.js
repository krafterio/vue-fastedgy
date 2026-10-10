/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { useDataTable } from '../composables/data-table.js';

vi.mock('vue-router', () => ({
    useRoute: () => ({ query: {} }),
    useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('../stores/metadata.js', () => ({
    useMetadataStore: () => ({
        getMetadata: () => Promise.resolve({}),
        getMetadatas: () =>
            Promise.resolve({
                invoice: {
                    fields: {
                        name: { type: 'char' },
                        amount_due: { type: 'computed' },
                    },
                },
            }),
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
});
