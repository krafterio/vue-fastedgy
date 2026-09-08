/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { describe, expect, it, vi } from 'vitest';
import { useSortable } from '../composables/sortable.js';

describe('useSortable', () => {
    it('reads the sortable state from the metadata the store hands back as a promise', async () => {
        const { isSortable, sortableField, ready } = useSortable(
            'aisle',
            Promise.resolve({ sortable: true, sortable_field: 'position' }),
            undefined
        );

        await ready;

        expect(isSortable.value).toBe(true);
        expect(sortableField.value).toBe('position');
    });

    it('leaves the list unsortable when the metadata says nothing', async () => {
        const { isSortable, ready } = useSortable('aisle', Promise.resolve({}), undefined);

        await ready;

        expect(isSortable.value).toBe(false);
    });

    it('keeps an explicit sortable on the default field when the metadata cannot be read', async () => {
        const { isSortable, sortableField, ready } = useSortable('aisle', Promise.reject(new Error('offline')), true);

        await ready;

        expect(isSortable.value).toBe(true);
        expect(sortableField.value).toBe('sequence');
    });

    it('sends the order where the dataset routes answer', async () => {
        const fetchSpy = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ model_name: 'aisle', records: [] }),
        });

        window.fetch = fetchSpy;

        const { resequence, ready } = useSortable('aisle', Promise.resolve({}), true, { prefix: '/{workspace}' });

        await ready;
        await resequence([2, 1]);

        expect(fetchSpy.mock.calls[0][0]).toContain('/{workspace}/dataset/resequence');
    });
});
