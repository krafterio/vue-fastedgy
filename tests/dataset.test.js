/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDataset } from '../composables/dataset.js';

const jsonResponse = (payload) => ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => payload,
});

const bodyOf = (call) => JSON.parse(call[1].body);

describe('useDataset', () => {
    let fetchSpy;

    beforeEach(() => {
        fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ model_name: 'aisle', records: [] }));
        window.fetch = fetchSpy;
    });

    it('gives a list the order the ids are in', async () => {
        const { resequence } = useDataset();

        const result = await resequence('aisle', [3, 1, 2]);
        const [url, options] = fetchSpy.mock.calls[0];

        expect(url).toBe('/dataset/resequence');
        expect(options.method).toBe('PUT');
        expect(bodyOf(fetchSpy.mock.calls[0])).toEqual({
            model_name: 'aisle',
            ids: [3, 1, 2],
            sequence_field: 'sequence',
            sequence_offset: 0,
        });
        expect(result).toEqual({ model_name: 'aisle', records: [] });
    });

    it('carries a group only when it has both halves to write', async () => {
        const { resequence } = useDataset();

        await resequence('task', [1], { groupField: 'stage', groupValue: 4 });
        await resequence('task', [1]);

        expect(bodyOf(fetchSpy.mock.calls[0]).group_field).toBe('stage');
        expect(bodyOf(fetchSpy.mock.calls[0]).group_value).toBe(4);
        expect(bodyOf(fetchSpy.mock.calls[1])).not.toHaveProperty('group_field');
    });

    it('addresses the surface it is given', async () => {
        const { resequence } = useDataset({ prefix: '/console' });

        await resequence('aisle', [1]);

        expect(fetchSpy.mock.calls[0][0]).toBe('/console/dataset/resequence');
    });
});
