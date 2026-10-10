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

const apis = vi.hoisted(() => ({}));

vi.mock('../composables/api.js', () => ({
    useApiModel: (name) => apis[name],
}));

vi.mock('../stores/auth.js', () => ({
    useAuthStore: () => ({ user: { id: 5 } }),
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

    it('sends the expression of the url, and keeps a new one and the current view in the url', async () => {
        router.route = { query: { f: JSON.stringify(['name', 'icontains', 'pom']), cv: '7' } };
        const service = { modelName: 'aliment', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };

        const iterator = useDataIterator(service, { sortable: false, filter: ['is_active', 'is true'] });

        await settle();

        expect(iterator.view.value).toBe(7);
        expect(service.list.mock.calls[0][0].filter).toEqual([
            ['is_active', 'is true'],
            ['name', 'icontains', 'pom'],
        ]);

        iterator.expression.value = [
            '|',
            [
                ['name', '=', 'Pomme'],
                ['name', '=', 'Poire'],
            ],
        ];
        iterator.view.value = null;
        await settle();

        expect(service.list).toHaveBeenCalledTimes(2);
        expect(router.replace).toHaveBeenLastCalledWith({
            query: {
                f: JSON.stringify([
                    '|',
                    [
                        ['name', '=', 'Pomme'],
                        ['name', '=', 'Poire'],
                    ],
                ]),
            },
        });
    });

    it('leaves the url to the screen it is drawn in when it holds its state itself', async () => {
        router.route = {
            query: { f: JSON.stringify(['name', 'icontains', 'pom']), q: 'pom', p: '2', order_by: 'name:asc' },
        };
        const service = { modelName: 'booking', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };

        const iterator = useDataIterator(service, {
            sortable: false,
            url: false,
            filter: ['status', '=', 'confirmed'],
            defaultOrderBy: ['start_at:desc'],
        });

        await settle();

        expect(service.list.mock.calls[0][0]).toMatchObject({
            page: 1,
            filter: ['status', '=', 'confirmed'],
            orderBy: ['start_at:desc'],
        });

        iterator.expression.value = ['status', '=', 'cancelled'];
        await settle();
        iterator.currentPage.value = 2;
        await settle();

        expect(service.list).toHaveBeenCalledTimes(3);
        expect(router.replace).not.toHaveBeenCalled();
    });

    it('ignores an expression of the url that does not read', async () => {
        router.route = { query: { f: '[name', cv: 'nope' } };
        const service = { modelName: 'aliment', list: vi.fn().mockResolvedValue(page([])) };

        const iterator = useDataIterator(service, { sortable: false });

        await settle();

        expect(iterator.expression.value).toBeNull();
        expect(iterator.view.value).toBeNull();
        expect(service.list.mock.calls[0][0].filter).toBeNull();
    });

    it('looks for the search in the fields it is given, any of them matching', async () => {
        router.route = { query: { q: 'dupont' } };
        const service = { modelName: 'household', list: vi.fn().mockResolvedValue(page([])) };

        useDataIterator(service, { sortable: false, searchFields: ['name', 'workspace_users.user.email'] });
        useDataIterator(service, { sortable: false, searchFields: ['name'] });

        await settle();

        expect(service.list.mock.calls[0][0].filter).toEqual([
            [
                '|',
                [
                    ['name', 'icontains', 'dupont'],
                    ['workspace_users.user.email', 'icontains', 'dupont'],
                ],
            ],
        ]);
        expect(service.list.mock.calls[1][0].filter).toEqual([['name', 'icontains', 'dupont']]);
    });

    it('reads its first page once, already on the view it starts from', async () => {
        apis.custom_view = {
            list: vi.fn().mockResolvedValue(page([{ id: 4, filters: ['plan', '=', 'plus'], order_by: ['name:asc'] }])),
        };
        apis.custom_view_favorite = { list: vi.fn().mockResolvedValue(page([])) };
        const service = { modelName: 'household', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };

        const iterator = useDataIterator(service, { sortable: false, views: { scope: '' } });

        await settle();

        expect(service.list).toHaveBeenCalledTimes(1);
        expect(service.list).toHaveBeenCalledWith(
            expect.objectContaining({ filter: [['plan', '=', 'plus']], orderBy: ['name:asc'] })
        );
        expect(iterator.view.value).toBe(4);
    });

    it('opens as the url says when it says what the list shows', async () => {
        router.route = { query: { q: 'du' } };
        apis.custom_view = { list: vi.fn() };
        apis.custom_view_favorite = { list: vi.fn() };
        const service = { modelName: 'household', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };

        useDataIterator(service, { sortable: false, views: true });

        await settle();

        expect(apis.custom_view.list).not.toHaveBeenCalled();
        expect(service.list).toHaveBeenCalledTimes(1);
    });

    it('keeps out of the url the filters of the view the list is on, and writes those moving away from them', async () => {
        apis.custom_view = {
            list: vi.fn().mockResolvedValue(page([{ id: 4, filters: ['plan', '=', 'plus'], order_by: null }])),
        };
        apis.custom_view_favorite = { list: vi.fn().mockResolvedValue(page([])) };
        const service = { modelName: 'household', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };
        const written = () => router.replace.mock.calls.at(-1)?.[0].query ?? {};

        const iterator = useDataIterator(service, { sortable: false, views: {} });

        await settle();

        expect(written().cv).toBe('4');
        expect(written()).not.toHaveProperty('f');

        iterator.expression.value = ['plan', '=', 'free'];
        await settle();
        expect(written().f).toBe('["plan","=","free"]');

        iterator.expression.value = ['plan', '=', 'plus'];
        await settle();
        expect(written()).not.toHaveProperty('f');

        iterator.expression.value = null;
        await settle();
        expect(written().f).toBe('null');
    });

    it('opens a link to a view on the filters of that view, read again', async () => {
        router.route = { query: { cv: '4' } };
        apis.custom_view = {
            get: vi.fn().mockResolvedValue({
                data: { id: 4, model: 'household', scope: '', filters: ['plan', '=', 'plus'], order_by: null },
            }),
            list: vi.fn(),
        };
        apis.custom_view_favorite = { list: vi.fn() };
        const service = { modelName: 'household', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };

        const iterator = useDataIterator(service, { sortable: false, views: {} });

        await settle();

        expect(apis.custom_view_favorite.list).not.toHaveBeenCalled();
        expect(service.list).toHaveBeenCalledTimes(1);
        expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ filter: [['plan', '=', 'plus']] }));
        expect(iterator.view.value).toBe(4);
    });

    it('opens a link carrying its own filters on them, its view staying the current one', async () => {
        router.route = { query: { cv: '4', f: '["plan","=","free"]' } };
        apis.custom_view = { get: vi.fn(), list: vi.fn() };
        apis.custom_view_favorite = { list: vi.fn() };
        const service = { modelName: 'household', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };

        const iterator = useDataIterator(service, { sortable: false, views: {} });

        await settle();

        expect(apis.custom_view.get).not.toHaveBeenCalled();
        expect(iterator.view.value).toBe(4);
        expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ filter: [['plan', '=', 'free']] }));
    });

    it('drops the view of a link that is not one of this list', async () => {
        router.route = { query: { cv: '4' } };
        apis.custom_view = {
            get: vi.fn().mockResolvedValue({ data: { id: 4, model: 'task', scope: '', filters: ['done', 'is true'] } }),
            list: vi.fn(),
        };
        apis.custom_view_favorite = { list: vi.fn() };
        const service = { modelName: 'household', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };

        const iterator = useDataIterator(service, { sortable: false, views: {} });

        await settle();

        expect(iterator.view.value).toBeNull();
        expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ filter: null }));
    });

    it('opens on what its view holds besides its filters, waits for it, and leaves the url its own say', async () => {
        apis.custom_view = {
            list: vi.fn().mockResolvedValue(page([{ id: 4, filters: null, order_by: null, group_by: 'plan' }])),
            get: vi.fn().mockResolvedValue({
                data: { id: 4, model: 'household', scope: '', filters: null, order_by: null, group_by: 'plan' },
            }),
        };
        apis.custom_view_favorite = { list: vi.fn().mockResolvedValue(page([])) };
        const service = { modelName: 'household', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };
        const groupBy = ref(null);
        const state = { group_by: { get: () => groupBy.value, set: (value) => (groupBy.value = value), key: 'group' } };

        const iterator = useDataIterator(service, { sortable: false, views: { state } });

        expect(iterator.opened.value).toBe(false);

        await settle();

        expect(iterator.opened.value).toBe(true);
        expect(iterator.viewState).toBe(state);
        expect(groupBy.value).toBe('plan');

        router.route = { query: { group: 'owner' } };
        groupBy.value = 'owner';
        useDataIterator(service, { sortable: false, views: { state } });
        await settle();

        expect(apis.custom_view.list).toHaveBeenCalledTimes(1);
        expect(groupBy.value).toBe('owner');

        router.route = { query: { cv: '4', group: 'owner' } };
        useDataIterator(service, { sortable: false, views: { state } });
        await settle();

        expect(apis.custom_view.get).toHaveBeenCalledTimes(1);
        expect(groupBy.value).toBe('owner');
    });

    it('keeps the default order out of the url, and any other in it', async () => {
        const service = { modelName: 'household', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };
        const written = () => router.replace.mock.calls.at(-1)?.[0].query ?? {};

        const iterator = useDataIterator(service, { sortable: false, defaultOrderBy: ['created_at:desc'] });

        iterator.orderBy.value = ['name:asc'];
        await settle();
        expect(written().order_by).toBe('name:asc');

        iterator.orderBy.value = ['created_at:desc'];
        await settle();
        expect(written()).not.toHaveProperty('order_by');
    });

    it('sends the rules of its quick filters, read from the url, and keeps there those away from their default', async () => {
        router.route = { query: { qf: '{"closed":true}' } };
        const closed = {
            name: 'closed',
            default: false,
            filter: (shown) => (shown ? null : ['status', '=', 'opened']),
        };
        const kind = {
            name: 'kind',
            default: 'all',
            filter: (value) => (value === 'all' ? null : ['type', '=', value]),
        };
        const service = { modelName: 'support_ticket', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };
        const written = () => router.replace.mock.calls.at(-1)?.[0].query ?? {};

        const iterator = useDataIterator(service, { sortable: false, quickFilters: [closed, { quickFilter: kind }] });

        await settle();

        expect(iterator.quick).toEqual({ closed: true, kind: 'all' });
        expect(iterator.quickFilters).toEqual([closed, { quickFilter: kind }]);
        expect(service.list).toHaveBeenLastCalledWith(expect.objectContaining({ filter: null }));

        iterator.quick.closed = false;
        iterator.quick.kind = 'idea';
        await settle();

        expect(service.list).toHaveBeenLastCalledWith(
            expect.objectContaining({
                filter: [
                    ['status', '=', 'opened'],
                    ['type', '=', 'idea'],
                ],
            })
        );
        expect(written().qf).toBe('{"kind":"idea"}');
    });

    it('goes back to its default order on the third click on a column, not to no order', async () => {
        const service = { modelName: 'household', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };
        const written = () => router.replace.mock.calls.at(-1)?.[0].query ?? {};

        const iterator = useDataIterator(service, { sortable: false, defaultOrderBy: ['created_at:desc'] });

        await settle();

        iterator.toggleSort('name');
        iterator.toggleSort('name');
        await settle();

        expect(iterator.orderBy.value).toEqual(['name:desc']);

        iterator.toggleSort('name');
        await settle();

        expect(iterator.orderBy.value).toEqual(['created_at:desc']);
        expect(service.list).toHaveBeenLastCalledWith(expect.objectContaining({ orderBy: ['created_at:desc'] }));
        expect(written()).not.toHaveProperty('order_by');
    });

    it('turns its default order around rather than staying on it when that order is the clicked column', async () => {
        const service = { modelName: 'household', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };

        const iterator = useDataIterator(service, { sortable: false, defaultOrderBy: ['name:desc'] });

        iterator.toggleSort('name');
        expect(iterator.orderBy.value).toEqual(['name:asc']);

        iterator.toggleSort('name');
        expect(iterator.orderBy.value).toEqual(['name:desc']);
    });
});
