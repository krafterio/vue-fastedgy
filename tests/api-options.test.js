/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useApiOptions } from '../composables/api-options.js';

const page = (items, total) => Promise.resolve({ data: { items, total } });

describe('useApiOptions', () => {
    let api;

    beforeEach(() => {
        api = {
            list: vi.fn(() => page([{ id: 1 }, { id: 2 }], 4)),
            get: vi.fn(() => Promise.resolve({ data: { id: 7, name: 'Krafter' } })),
        };
    });

    it('reads the fields the caller shows, its own id included', async () => {
        const { search } = useApiOptions(api, { fields: ['name', 'image'] });

        await search();

        expect(api.list.mock.calls[0][0].fields).toEqual(['id', 'name', 'image']);
    });

    it('leaves a text shorter than what the caller asked for alone', async () => {
        const { search } = useApiOptions(api, {
            minSearchLength: 2,
            searchFilter: (text) => ['name', 'icontains', text],
        });

        await search('a');

        expect(api.list).not.toHaveBeenCalled();
    });

    it('joins the search to the filter it always applies', async () => {
        const { search } = useApiOptions(api, {
            filter: () => ['published', 'is true'],
            searchFilter: (text) => ['name', 'icontains', text],
        });

        await search('kraft');

        expect(api.list.mock.calls[0][0].filter).toEqual([
            '&',
            [
                ['published', 'is true'],
                ['name', 'icontains', 'kraft'],
            ],
        ]);
    });

    it('continues the list where it stopped, until there is no more', async () => {
        const { items, hasMore, search, loadMore } = useApiOptions(api, { limit: 2 });

        await search();

        expect(hasMore.value).toBe(true);

        api.list.mockImplementation(() => page([{ id: 3 }, { id: 4 }], 4));
        await loadMore();

        expect(items.value.map((item) => item.id)).toEqual([1, 2, 3, 4]);
        expect(api.list.mock.calls[1][0].offset).toBe(2);
        expect(hasMore.value).toBe(false);
    });

    it('reads back the record a field holds by its id', async () => {
        const { resolve } = useApiOptions(api, { fields: ['name'] });

        expect(await resolve(7)).toEqual({ id: 7, name: 'Krafter' });
        expect(api.get).toHaveBeenCalledWith(7, { fields: ['id', 'name'] });
    });
});
