/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { useDataIterator } from '../composables/data-iterator.js';

const router = vi.hoisted(() => ({ route: { query: {} }, replace: null }));

vi.mock('vue-router', () => ({
    useRoute: () => router.route,
    useRouter: () => ({ replace: router.replace }),
}));

vi.mock('../stores/metadata.js', () => ({
    useMetadataStore: () => ({ getMetadata: () => Promise.resolve({}) }),
}));

const page = (items) => ({ data: { items, total: items.length } });

const settle = async () => {
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve));
};

describe('useDataIterator', () => {
    beforeEach(() => {
        router.route = { query: {} };
        router.replace = vi.fn();
    });

    it('holds every read back until the caller enables it, then reads once', async () => {
        const enabled = ref(false);
        const service = { modelName: 'aisle', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };

        const iterator = useDataIterator(service, { enabled, sortable: false });

        await settle();
        await iterator.refresh();

        expect(service.list).not.toHaveBeenCalled();

        enabled.value = true;
        await settle();

        expect(service.list).toHaveBeenCalledTimes(1);
        expect(iterator.items.value).toEqual([{ id: 1 }]);
    });

    it('keeps the latest read when an earlier one answers after it', async () => {
        let answerFirst;
        const service = {
            modelName: 'aisle',
            list: vi
                .fn()
                .mockImplementationOnce(() => new Promise((resolve) => (answerFirst = resolve)))
                .mockResolvedValueOnce(page([{ id: 2 }])),
        };

        const iterator = useDataIterator(service, { sortable: false });

        await settle();
        await iterator.refresh();

        answerFirst(page([{ id: 1 }]));
        await settle();

        expect(iterator.items.value).toEqual([{ id: 2 }]);
        expect(iterator.loading.value).toBe(false);
    });

    it('reads again for a column it has not read, not for the fields it just read', async () => {
        const fields = ref(['id', 'name']);
        const service = { modelName: 'aisle', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };

        useDataIterator(service, { sortable: false, fieldsResolver: () => fields.value });

        await settle();

        expect(service.list).toHaveBeenCalledTimes(1);
        expect(service.list.mock.calls[0][0].fields).toEqual(['id', 'name']);

        fields.value = ['id', 'name'];
        await settle();

        expect(service.list).toHaveBeenCalledTimes(1);

        fields.value = ['id', 'name', 'status.name'];
        await settle();

        expect(service.list).toHaveBeenCalledTimes(2);
    });

    it('reads again on the rules a filter says, not on the array that says them', async () => {
        const closed = ref('is false');
        const rebuilt = ref(0);
        const service = { modelName: 'aisle', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };

        useDataIterator(service, {
            sortable: false,
            // What a screen hands over: a new array on every recompute, of
            // whatever the columns and the model fields around it are worth.
            filter: () => {
                void rebuilt.value;

                return [['closed', closed.value]];
            },
        });

        await settle();

        expect(service.list).toHaveBeenCalledTimes(1);

        rebuilt.value += 1;
        await settle();

        expect(service.list).toHaveBeenCalledTimes(1);

        closed.value = 'is true';
        await settle();

        expect(service.list).toHaveBeenCalledTimes(2);
    });

    it('matches the search of the url, and keeps the search typed in the url as q', async () => {
        router.route = { query: { q: 'tomate' } };
        const service = { modelName: 'aisle', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };

        const iterator = useDataIterator(service, { sortable: false });

        await settle();

        expect(service.list.mock.calls[0][0].filter).toEqual([['search_value', 'search_fuzzy', 'tomate']]);

        vi.useFakeTimers();
        iterator.search.value = ' carotte ';
        await vi.advanceTimersByTimeAsync(300);
        vi.useRealTimers();
        await settle();

        expect(service.list).toHaveBeenCalledTimes(2);
        expect(service.list.mock.calls[1][0].filter).toEqual([['search_value', 'search_fuzzy', 'carotte']]);
        expect(router.replace).toHaveBeenLastCalledWith({ query: { q: 'carotte' } });
    });

    it('reads the pages of the url at once when it appends, and keeps the next one in the url', async () => {
        router.route = { query: { p: '3' } };
        const service = {
            modelName: 'aisle',
            list: vi.fn().mockResolvedValue({ data: { items: [{ id: 1 }], total: 500 } }),
        };

        const iterator = useDataIterator(service, { sortable: false, append: true, pageSize: 25 });

        await settle();

        expect(service.list.mock.calls[0][0]).toMatchObject({ page: 1, size: 75 });

        await iterator.loadMore();
        await settle();

        expect(service.list.mock.calls[1][0]).toMatchObject({ page: 4, size: 25 });
        expect(router.replace).toHaveBeenLastCalledWith({ query: { p: '4' } });
    });

    it('restores the scroll position of the url and keeps the new one in the url', async () => {
        router.route = { query: { sl: '480' } };
        const element = document.createElement('div');
        const scrollTo = vi.fn();
        element.scrollTo = scrollTo;
        const service = { modelName: 'aisle', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };

        useDataIterator(service, { sortable: false, scrollTarget: ref(element) });

        await settle();

        expect(scrollTo).toHaveBeenCalledWith({ top: 480 });

        vi.useFakeTimers();
        element.scrollTop = 120;
        element.dispatchEvent(new Event('scroll'));
        await vi.advanceTimersByTimeAsync(350);
        vi.useRealTimers();
        await settle();

        expect(router.replace).toHaveBeenLastCalledWith({ query: { sl: '120' } });
    });
});
