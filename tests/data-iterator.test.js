/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, reactive, ref } from 'vue';
import { useDataIterator } from '../composables/data-iterator.js';
import { bus } from '../composables/bus.js';
import { RESOURCES_STALE } from '../composables/realtime.js';

const router = vi.hoisted(() => ({ route: { query: {} }, replace: null }));

vi.mock('vue-router', () => ({
    useRoute: () => router.route,
    useRouter: () => router,
}));

const apis = vi.hoisted(() => ({}));
const apiParams = vi.hoisted(() => ({}));

vi.mock('../composables/api.js', () => ({
    useApiModel: (name, params) => {
        apiParams[name] = params;

        return apis[name];
    },
}));

vi.mock('../stores/auth.js', () => ({
    useAuthStore: () => ({ user: { id: 5 } }),
}));

const metadata = vi.hoisted(() => ({ model: {} }));

vi.mock('../stores/metadata.js', () => ({
    useMetadataStore: () => ({ getMetadata: () => Promise.resolve(metadata.model) }),
}));

const dataset = vi.hoisted(() => ({ resequence: null }));

vi.mock('../composables/dataset.js', () => ({
    useDataset: () => ({ resequence: (...args) => dataset.resequence(...args) }),
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
        metadata.model = {};
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

    it('reads a term written without a direction as ascending, as the server does', async () => {
        router.route = { query: { order_by: 'name,created_at:desc' } };
        const service = { modelName: 'household', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };

        const iterator = useDataIterator(service, { sortable: false });

        expect(iterator.getSortDirection('name')).toBe('asc');
        expect(iterator.getSortDirection('created_at')).toBe('desc');
        expect(iterator.getSortDirection('name_short')).toBeNull();

        iterator.toggleSort('name');

        expect(iterator.orderBy.value).toEqual(['name:desc']);
    });

    it('reads again every page an appended list holds on a refresh, without folding it back to the first one', async () => {
        const service = {
            modelName: 'aisle',
            list: vi.fn().mockResolvedValue({ data: { items: [{ id: 1 }], total: 500 } }),
        };

        const iterator = useDataIterator(service, { sortable: false, append: true, pageSize: 25 });

        await settle();
        await iterator.loadMore();
        await iterator.loadMore();
        await settle();

        expect(iterator.currentPage.value).toBe(3);

        await iterator.refresh();
        await settle();

        expect(service.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 75 }));
        expect(iterator.currentPage.value).toBe(3);
        expect(router.replace).toHaveBeenLastCalledWith({ query: { p: '3' } });
    });

    it('adds the next page to the rows on loadMore, even on a list that pages, and reads them again together', async () => {
        const service = {
            modelName: 'aisle',
            list: vi.fn(async ({ page: at, size }) => ({
                data: {
                    items: Array.from({ length: size }, (_, index) => ({ id: (at - 1) * 2 + index + 1 })),
                    total: 500,
                },
            })),
        };

        const iterator = useDataIterator(service, { sortable: false, pageSize: 2, availablePageSizes: [2] });

        await settle();
        await iterator.loadMore();
        await settle();

        expect(service.list).toHaveBeenCalledTimes(2);
        expect(service.list.mock.calls[1][0]).toMatchObject({ page: 2, size: 2 });
        expect(iterator.items.value.map((item) => item.id)).toEqual([1, 2, 3, 4]);
        expect(iterator.currentPage.value).toBe(2);

        await iterator.refresh();
        await settle();

        expect(service.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 4 }));
        expect(iterator.items.value.map((item) => item.id)).toEqual([1, 2, 3, 4]);
    });

    it('says there is nothing more once the page shown is the last one, on a list that pages', async () => {
        router.route = { query: { p: '3' } };
        const service = {
            modelName: 'aisle',
            list: vi.fn().mockResolvedValue({ data: { items: [{ id: 5 }], total: 5 } }),
        };

        const iterator = useDataIterator(service, { sortable: false, pageSize: 2, availablePageSizes: [2] });

        await settle();

        expect(service.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3, size: 2 }));
        expect(iterator.hasMore.value).toBe(false);
    });

    it('reads again at the new page size, from the first page as from any other', async () => {
        const service = {
            modelName: 'aisle',
            list: vi.fn().mockResolvedValue({ data: { items: [{ id: 1 }], total: 500 } }),
        };

        const iterator = useDataIterator(service, { sortable: false });

        await settle();
        iterator.pageSize.value = 100;
        await settle();

        expect(service.list).toHaveBeenCalledTimes(2);
        expect(service.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 100 }));

        iterator.currentPage.value = 3;
        await settle();
        iterator.pageSize.value = 25;
        await settle();

        expect(service.list).toHaveBeenCalledTimes(4);
        expect(service.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 25 }));
    });

    it('reads once when the screen sets its own filter', async () => {
        const service = { modelName: 'aisle', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };

        const iterator = useDataIterator(service, { sortable: false, filter: [['closed', 'is false']] });

        await settle();
        iterator.filter.value = ['status', '=', 'opened'];
        await settle();

        expect(service.list).toHaveBeenCalledTimes(2);
        expect(service.list).toHaveBeenLastCalledWith(
            expect.objectContaining({
                filter: [
                    ['closed', 'is false'],
                    ['status', '=', 'opened'],
                ],
            })
        );
    });

    it('sends the offset of the rows it reorders and the group they are in', async () => {
        router.route = { query: { p: '3' } };
        dataset.resequence = vi.fn().mockResolvedValue({ model_name: 'task', records: [] });
        const service = {
            modelName: 'task',
            list: vi.fn().mockResolvedValue({ data: { items: [{ id: 4 }, { id: 5 }], total: 500 } }),
        };

        const iterator = useDataIterator(service, { sortable: true, pageSize: 25 });

        await settle();
        await iterator.resequence([5, 4], { groupField: 'status', groupValue: 3 });

        expect(dataset.resequence).toHaveBeenCalledWith('task', [5, 4], {
            sequenceField: 'sequence',
            sequenceOffset: 50,
            groupField: 'status',
            groupValue: 3,
        });
    });

    it('stops the manual order while a search, an expression, a quick filter or its own filter narrows the list', async () => {
        const kind = {
            name: 'kind',
            default: 'all',
            filter: (value) => (value === 'all' ? null : ['type', '=', value]),
        };
        const service = { modelName: 'task', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };

        const iterator = useDataIterator(service, {
            sortable: true,
            filter: [['project', '=', 3]],
            quickFilters: [kind],
        });

        await settle();
        expect(iterator.isSortable.value).toBe(true);

        iterator.expression.value = ['name', 'ilike', 'tomate'];
        await settle();
        expect(iterator.isSortable.value).toBe(false);

        iterator.expression.value = null;
        iterator.filter.value = ['status', '=', 'opened'];
        await settle();
        expect(iterator.isSortable.value).toBe(false);

        iterator.filter.value = null;
        iterator.quick.kind = 'idea';
        await settle();
        expect(iterator.isSortable.value).toBe(false);

        iterator.quick.kind = 'all';
        await settle();
        expect(iterator.isSortable.value).toBe(true);
        expect(service.list.mock.calls.every(([query]) => query.fields.includes('sequence'))).toBe(true);
    });

    it('stops the manual order while the list is searched', async () => {
        router.route = { query: { q: 'tomate' } };
        const service = { modelName: 'task', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };

        const iterator = useDataIterator(service, { sortable: true });

        await settle();

        expect(iterator.isSortable.value).toBe(false);
    });

    it('sends the delimiter of an imported csv, and lets the server detect it otherwise', async () => {
        const result = { success: 2, errors: 0, created: 2, updated: 0 };
        const service = {
            modelName: 'aisle',
            list: vi.fn().mockResolvedValue(page([{ id: 1 }])),
            import: vi.fn().mockResolvedValue({ data: result }),
        };
        const file = new File(['name;code'], 'aisles.csv', { type: 'text/csv' });

        const iterator = useDataIterator(service, { sortable: false });

        await settle();

        expect(await iterator.importData(file, { delimiter: ';' })).toEqual(result);
        expect(service.import).toHaveBeenLastCalledWith(file, { delimiter: ';' });

        await iterator.importData(file);

        expect(service.import).toHaveBeenLastCalledWith(file, {});
    });

    it('empties its selection when its filter changes, and keeps it from one page to another', async () => {
        const service = {
            modelName: 'aisle',
            list: vi.fn().mockResolvedValue({ data: { items: [{ id: 1 }], total: 500 } }),
        };

        const iterator = useDataIterator(service, { sortable: false, enableSelection: true });

        await settle();
        iterator.selection.add([1, 2]);
        iterator.currentPage.value = 2;
        await settle();

        expect(iterator.selection.ids).toEqual([1, 2]);

        iterator.filter.value = ['status', '=', 'opened'];
        await settle();

        expect(iterator.selection.ids).toEqual([]);
        expect(iterator.selection.all).toBe(false);
    });

    it('looks for its views under the prefix of its api model when the views name none', async () => {
        apis.custom_view = { list: vi.fn().mockResolvedValue(page([])) };
        apis.custom_view_favorite = { list: vi.fn().mockResolvedValue(page([])) };
        const service = {
            modelName: 'invoice',
            prefix: '/console',
            list: vi.fn().mockResolvedValue(page([{ id: 1 }])),
        };

        useDataIterator(service, { sortable: false, views: { scope: '' } });

        await settle();

        expect(apiParams.custom_view).toEqual({ prefix: '/console' });
        expect(apiParams.custom_view_favorite).toEqual({ prefix: '/console' });
    });

    it('writes the keys of two lists of one page together, neither losing those of the other', async () => {
        const service = { modelName: 'task', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };
        const other = { modelName: 'note', list: vi.fn().mockResolvedValue(page([{ id: 2 }])) };

        const tasks = useDataIterator(service, { sortable: false });
        const notes = useDataIterator(other, { sortable: false });

        await settle();
        tasks.orderBy.value = ['name:asc'];
        notes.expression.value = ['title', 'icontains', 'idée'];
        await settle();

        expect(router.replace).toHaveBeenLastCalledWith({
            query: { order_by: 'name:asc', f: JSON.stringify(['title', 'icontains', 'idée']) },
        });
    });

    it('reads and writes its keys after the prefix it is given, leaving those of another list alone', async () => {
        router.route = { query: { done_p: '2', done_q: 'facture', p: '5' } };
        const service = {
            modelName: 'task',
            list: vi.fn().mockResolvedValue({ data: { items: [{ id: 1 }], total: 500 } }),
        };

        const iterator = useDataIterator(service, { sortable: false, url: { prefix: 'done_' } });

        await settle();

        expect(iterator.currentPage.value).toBe(2);
        expect(iterator.search.value).toBe('facture');
        expect(service.list).toHaveBeenLastCalledWith(
            expect.objectContaining({ page: 2, filter: [['search_value', 'search_fuzzy', 'facture']] })
        );

        iterator.orderBy.value = ['done_at:desc'];
        await settle();

        expect(router.replace).toHaveBeenLastCalledWith({
            query: { done_order_by: 'done_at:desc', done_q: 'facture', p: '5' },
        });
    });

    it('follows the url when it changes from outside, in one read', async () => {
        router.route = reactive({ query: {} });
        const service = {
            modelName: 'task',
            list: vi.fn().mockResolvedValue({ data: { items: [{ id: 1 }], total: 500 } }),
        };

        const iterator = useDataIterator(service, { sortable: false, defaultOrderBy: ['sequence:asc'] });

        await settle();
        router.route.query = { p: '3', order_by: 'name:desc', q: 'pomme' };
        await settle();

        expect(iterator.currentPage.value).toBe(3);
        expect(iterator.orderBy.value).toEqual(['name:desc']);
        expect(iterator.search.value).toBe('pomme');
        expect(service.list).toHaveBeenCalledTimes(2);
        expect(service.list).toHaveBeenLastCalledWith(
            expect.objectContaining({
                page: 3,
                orderBy: ['name:desc'],
                filter: [['search_value', 'search_fuzzy', 'pomme']],
            })
        );
        expect(router.replace).not.toHaveBeenCalled();

        router.route.query = {};
        await settle();

        expect(iterator.currentPage.value).toBe(1);
        expect(iterator.orderBy.value).toEqual(['sequence:asc']);
        expect(iterator.search.value).toBe('');
        expect(service.list).toHaveBeenCalledTimes(3);
    });

    it('does not take its own writes landing late for a change from outside', async () => {
        router.route = reactive({ query: {} });
        const service = {
            modelName: 'task',
            list: vi.fn().mockResolvedValue({ data: { items: [{ id: 1 }], total: 500 } }),
        };
        const land = (index) => (router.route.query = router.replace.mock.calls[index][0].query);

        const iterator = useDataIterator(service, { sortable: false });

        await settle();
        iterator.currentPage.value = 2;
        await settle();
        iterator.currentPage.value = 3;
        await settle();
        land(0);
        await settle();
        land(1);
        await settle();

        expect(iterator.currentPage.value).toBe(3);
        expect(service.list).toHaveBeenCalledTimes(3);
        expect(service.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));
    });

    it('opens the view a url changed from outside names', async () => {
        router.route = reactive({ query: {} });
        apis.custom_view = {
            list: vi.fn().mockResolvedValue(page([])),
            get: vi.fn().mockResolvedValue({
                data: { id: 4, model: 'household', scope: '', filters: ['plan', '=', 'plus'], order_by: ['name:asc'] },
            }),
        };
        apis.custom_view_favorite = { list: vi.fn().mockResolvedValue(page([])) };
        const service = { modelName: 'household', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };

        const iterator = useDataIterator(service, { sortable: false, views: { scope: '' } });

        await settle();
        router.route.query = { cv: '4', order_by: 'name:asc' };
        await settle();

        expect(apis.custom_view.get).toHaveBeenCalledWith(4, expect.anything());
        expect(iterator.view.value).toBe(4);
        expect(iterator.expression.value).toEqual(['plan', '=', 'plus']);
        expect(service.list).toHaveBeenCalledTimes(2);
        expect(service.list).toHaveBeenLastCalledWith(
            expect.objectContaining({ filter: [['plan', '=', 'plus']], orderBy: ['name:asc'] })
        );
    });

    it('starts over on a workspace switch: back to its opening, its metadata read again, one read', async () => {
        router.route = reactive({ query: {} });
        metadata.model = { sortable: true, sortable_field: 'sequence' };
        const scope = effectScope();
        const service = {
            modelName: 'task',
            list: vi.fn().mockResolvedValue({ data: { items: [{ id: 1 }], total: 500 } }),
        };
        const iterator = scope.run(() =>
            useDataIterator(service, { enableSelection: true, defaultOrderBy: ['sequence:asc'] })
        );

        await settle();
        expect(iterator.isSortable.value).toBe(true);

        iterator.currentPage.value = 3;
        iterator.selection.add([1]);
        await settle();
        iterator.orderBy.value = ['name:desc'];
        iterator.expression.value = ['name', 'icontains', 'devis'];
        await settle();
        const reads = service.list.mock.calls.length;

        metadata.model = {};
        bus.trigger(RESOURCES_STALE, { since: performance.now() });
        await settle();
        await settle();

        expect(iterator.currentPage.value).toBe(1);
        expect(iterator.orderBy.value).toEqual(['sequence:asc']);
        expect(iterator.expression.value).toBeNull();
        expect(iterator.selection.ids).toEqual([]);
        expect(iterator.isSortable.value).toBe(false);
        expect(service.list).toHaveBeenCalledTimes(reads + 1);
        expect(service.list).toHaveBeenLastCalledWith(
            expect.objectContaining({ page: 1, orderBy: ['sequence:asc'], filter: null, fields: ['id'] })
        );

        scope.stop();
    });

    it('leaves alone a workspace switch that began before it was made', async () => {
        const since = performance.now();
        const scope = effectScope();
        const service = { modelName: 'task', list: vi.fn().mockResolvedValue(page([{ id: 1 }])) };
        const iterator = scope.run(() => useDataIterator(service, { sortable: false }));

        await settle();
        iterator.expression.value = ['name', 'icontains', 'devis'];
        await settle();

        bus.trigger(RESOURCES_STALE, { since });
        await settle();

        expect(iterator.expression.value).toEqual(['name', 'icontains', 'devis']);
        expect(service.list).toHaveBeenCalledTimes(2);

        scope.stop();
    });
});
