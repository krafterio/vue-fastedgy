/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, reactive, ref } from 'vue';
import { useDataIterator as makeIterator } from '../composables/data-iterator.js';
import { useCustomViews } from '../composables/custom-views.js';
import { listContext } from '../composables/record-context.js';
import { bus } from '../composables/bus.js';
import { RESOURCES_STALE } from '../composables/realtime.js';
import { RESOURCE_CHANGED } from '../network/realtime.js';

const router = vi.hoisted(() => ({ route: { query: {} }, replace: null }));

vi.mock('vue-router', () => ({
    useRoute: () => router.route,
    useRouter: () => router,
}));

const apis = vi.hoisted(() => ({}));

vi.mock('../composables/api.js', () => ({
    useApiModel: (name) => apis[name],
}));

vi.mock('../stores/auth.js', () => ({
    useAuthStore: () => ({ user: { id: 5 } }),
}));

const metadatas = vi.hoisted(() => ({}));

vi.mock('../stores/metadata.js', () => ({
    useMetadataStore: () => ({ getMetadata: (name) => Promise.resolve(metadatas[name] ?? null) }),
}));

const dataset = vi.hoisted(() => ({ resequence: null }));

vi.mock('../composables/dataset.js', () => ({
    useDataset: () => ({ resequence: (...args) => dataset.resequence(...args) }),
}));

const settle = async () => {
    for (let turn = 0; turn < 3; turn++) {
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve));
    }
};

const field = (name, type, values = {}) => ({
    name,
    label: name,
    type,
    readonly: false,
    required: false,
    extra: false,
    filter_operators: [],
    ...values,
});

const valueOf = (raw) => (raw !== null && typeof raw === 'object' ? raw.id : raw);

/** Whether a row holds under a filter: a rule, a group of them, or a list of them all applying. */
function matches(row, rule) {
    if (!Array.isArray(rule) || rule.length === 0) {
        return true;
    }

    const [head] = rule;

    if (head === '&' || head === '|') {
        return head === '&' ? rule[1].every((one) => matches(row, one)) : rule[1].some((one) => matches(row, one));
    }

    if (Array.isArray(head)) {
        return rule.every((one) => matches(row, one));
    }

    const value = valueOf(row[head]);

    switch (rule[1]) {
        case '=':
            return value === rule[2];
        case 'is empty':
            return value == null;
        case 'is true':
            return value === true;
        case 'is false':
            return value === false;
        case 'icontains':
            return String(value ?? '')
                .toLowerCase()
                .includes(String(rule[2]).toLowerCase());
        default:
            throw new Error(`Unknown operator ${rule[1]}`);
    }
}

/** A page of the rows a query reads, in their manual order. */
function answer(rows, query) {
    const matched = rows
        .filter((row) => matches(row, query.filter))
        .sort((one, other) => one.sequence - other.sequence);
    const offset = query.offset ?? (query.page - 1) * query.size;
    const limit = query.limit ?? query.size;

    return { data: { items: matched.slice(offset, offset + limit).map((row) => ({ ...row })), total: matched.length } };
}

describe('a list grouped by a field', () => {
    // Each list goes with its test: one left behind would answer the workspace switch of another.
    let scope;

    const useDataIterator = (model, options) => scope.run(() => makeIterator(model, options));

    afterEach(() => scope.stop());

    let things;
    let stages;
    let service;

    const filters = () => service.list.mock.calls.map(([query]) => query.filter);
    const labels = (list) => list.groups.value.map((group) => group.label);
    const groupOf = (list, key) => list.groups.value.find((group) => group.key === key);
    const idsOf = (group) => group.items.map((row) => row.id);

    beforeEach(() => {
        scope = effectScope();
        router.route = { query: {} };
        router.replace = vi.fn((to) => {
            router.route.query = to.query;
        });

        metadatas.thing = {
            name: 'thing',
            sortable: true,
            sortable_field: 'sequence',
            fields: {
                name: field('name', 'char'),
                stage: field('stage', 'many2one', { target: 'stage' }),
                priority: field('priority', 'choice', { choices: { low: 'Low', high: 'High' } }),
                level: field('level', 'choice', { required: true, choices: { one: 'One' } }),
                kind: field('kind', 'choice', { readonly: true, choices: { a: 'A' } }),
                urgent: field('urgent', 'boolean'),
                extra_size: field('extra_size', 'choice', { extra: true, choices: { s: 'S', l: 'L' } }),
                sequence: field('sequence', 'integer'),
            },
        };
        metadatas.stage = {
            name: 'stage',
            sortable: true,
            sortable_field: 'sequence',
            fields: {
                id: field('id', 'integer'),
                name: field('name', 'char'),
                color: field('color', 'char'),
                is_done: field('is_done', 'boolean'),
                sequence: field('sequence', 'integer'),
            },
        };

        things = [
            { id: 1, name: 'Lamp', stage: 1, priority: 'low', urgent: true, extra_size: 's', sequence: 1 },
            { id: 2, name: 'Desk', stage: 1, priority: 'high', urgent: false, extra_size: 'l', sequence: 2 },
            { id: 3, name: 'Chair', stage: 2, priority: 'high', urgent: false, extra_size: null, sequence: 3 },
            { id: 4, name: 'Shelf', stage: null, priority: null, urgent: false, extra_size: null, sequence: 4 },
            { id: 5, name: 'Table', stage: 2, priority: 'low', urgent: true, extra_size: 's', sequence: 5 },
        ];
        stages = [
            { id: 1, name: 'To do', color: '#ff0000', is_done: false, sequence: 1 },
            { id: 2, name: 'Done', color: null, is_done: true, sequence: 2 },
        ];

        service = {
            modelName: 'thing',
            list: vi.fn(async (query) => answer(things, query)),
            update: vi.fn(async (id, payload) => {
                const row = things.find((one) => one.id === id);

                Object.assign(row, payload);

                return { data: { ...row } };
            }),
        };

        apis.stage = { list: vi.fn(async (query) => answer(stages, query)) };
        apis.custom_view = { list: vi.fn().mockResolvedValue({ data: { items: [], total: 0 } }), create: vi.fn() };
        apis.custom_view_favorite = { list: vi.fn().mockResolvedValue({ data: { items: [], total: 0 } }) };

        // The order a resequence writes, as the server does.
        dataset.resequence = vi.fn(async (model, ids, options) => {
            const rows = model === 'stage' ? stages : things;

            ids.forEach((id, index) => {
                const row = rows.find((one) => one.id === id);

                row[options.sequenceField] = options.sequenceOffset + index;

                if (options.groupField != null) {
                    row[options.groupField] = options.groupValue;
                }
            });

            return { model_name: model, records: [] };
        });
    });

    describe('the axis', () => {
        it('groups by the choices of a field, each read with the filter of the list and its rule, the axis read by none', async () => {
            const list = useDataIterator(service, { groupBy: 'priority', fields: ['name'] });

            await settle();

            expect(labels(list)).toEqual(['Low', 'High', 'No value']);
            expect(filters()).toEqual([
                ['priority', '=', 'low'],
                ['priority', '=', 'high'],
                ['priority', 'is empty'],
            ]);
            expect(list.total.value).toBe(5);
            expect(list.items.value).toHaveLength(5);
            expect(list.loaded.value).toBe(true);
            expect(list.hasMore.value).toBe(false);

            list.filter.value = ['name', 'icontains', 'a'];
            await settle();

            expect(filters().slice(3)).toEqual(
                [
                    ['priority', '=', 'low'],
                    ['priority', '=', 'high'],
                    ['priority', 'is empty'],
                ].map((rule) => ['&', [[['name', 'icontains', 'a']], rule]])
            );
            expect(list.groups.value.map((group) => group.total)).toEqual([2, 1, 0]);
            expect(list.total.value).toBe(3);
        });

        it('groups by a boolean, yes then no, with no group of rows with no value', async () => {
            const list = useDataIterator(service, { groupBy: 'urgent' });

            await settle();

            expect(labels(list)).toEqual(['Yes', 'No']);
            expect(filters()).toEqual([
                ['urgent', 'is true'],
                ['urgent', 'is false'],
            ]);
            expect(apis.stage.list).not.toHaveBeenCalled();
        });

        it('groups by the records of a relation, in the scope of the relation, with their color and the fields asked', async () => {
            const list = useDataIterator(service, {
                groupBy: 'stage',
                groupFields: ['is_done'],
                relationScopes: () => ({ stage: ['is_done', 'is false'] }),
            });

            await settle();

            expect(apis.stage.list.mock.calls[0][0]).toEqual({
                page: 1,
                size: 50,
                fields: ['id', 'name', 'color', 'is_done'],
                filter: ['is_done', 'is false'],
            });
            expect(labels(list)).toEqual(['To do', 'No value']);
            expect(list.groups.value[0].color).toBe('#ff0000');
            expect(list.groups.value[0].record.is_done).toBe(false);
            expect(list.groupPage.value).toBe(1);
            expect(list.groupTotalPages.value).toBe(1);
        });

        it('puts the group with no value first or leaves it out, as said for the field, and has none for a required field', async () => {
            const first = useDataIterator(service, { groupBy: 'priority', emptyGroup: 'first' });
            const none = useDataIterator(service, { groupBy: 'priority', emptyGroup: 'none' });
            const byField = useDataIterator(service, {
                groupBy: 'priority',
                emptyGroup: (name) => (name === 'priority' ? 'none' : 'last'),
            });
            const required = useDataIterator(service, { groupBy: 'level' });

            await settle();

            expect(labels(first)).toEqual(['No value', 'Low', 'High']);
            expect(labels(none)).toEqual(['Low', 'High']);
            expect(labels(byField)).toEqual(['Low', 'High']);
            expect(labels(required)).toEqual(['One']);
        });

        it('says a field that does not group, and reads nothing', async () => {
            const list = useDataIterator(service, { groupBy: 'name' });

            await settle();

            expect(list.error.value).toBe("This field can't be grouped.");
            expect(list.groups.value).toEqual([]);
            expect(service.list).not.toHaveBeenCalled();
            expect(list.loaded.value).toBe(true);
            expect(list.groupableFields.value.map((one) => one.name)).toEqual([
                'stage',
                'priority',
                'level',
                'kind',
                'urgent',
                'extra_size',
            ]);
        });

        it('adds the rule of the screen to the read of the group it is for alone', async () => {
            const list = useDataIterator(service, {
                groupBy: 'stage',
                groupFilter: (group) => (group.record?.is_done ? ['name', 'icontains', 'e'] : null),
            });

            await settle();

            expect(filters()).toEqual([
                ['stage', '=', 1],
                [
                    '&',
                    [
                        ['stage', '=', 2],
                        ['name', 'icontains', 'e'],
                    ],
                ],
                ['stage', 'is empty'],
            ]);
            expect(groupOf(list, 'id:2').filter).toEqual(filters()[1]);
        });

        it('reads the rows of a group again when its rule follows its record', async () => {
            const list = useDataIterator(service, {
                groupBy: 'stage',
                groupFilter: (group) => (group.record?.is_done ? ['name', 'icontains', 'e'] : null),
            });

            await settle();

            const reads = service.list.mock.calls.length;

            stages[0].is_done = true;
            vi.useFakeTimers();
            bus.trigger(RESOURCE_CHANGED, { model: 'stage', id: 1, action: 'updated' });
            await vi.advanceTimersByTimeAsync(250);
            vi.useRealTimers();
            await settle();

            expect(service.list).toHaveBeenCalledTimes(reads + 1);
            expect(service.list).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    filter: [
                        '&',
                        [
                            ['stage', '=', 1],
                            ['name', 'icontains', 'e'],
                        ],
                    ],
                })
            );
            expect(groupOf(list, 'id:1').filter).toEqual(service.list.mock.lastCall[0].filter);
        });

        it('reads the records of the axis again when they change, the groups that stay keeping their rows', async () => {
            const list = useDataIterator(service, { groupBy: 'stage' });

            await settle();

            const reads = service.list.mock.calls.length;

            stages[1].name = 'Closed';
            stages.push({ id: 3, name: 'Waiting', color: null, is_done: false, sequence: 3 });
            vi.useFakeTimers();
            bus.trigger(RESOURCE_CHANGED, { model: 'stage', id: 3, action: 'created' });
            await vi.advanceTimersByTimeAsync(250);
            vi.useRealTimers();
            await settle();

            expect(labels(list)).toEqual(['To do', 'Closed', 'Waiting', 'No value']);
            expect(service.list).toHaveBeenCalledTimes(reads + 1);
            expect(service.list).toHaveBeenLastCalledWith(expect.objectContaining({ filter: ['stage', '=', 3] }));
        });
    });

    describe('the rows of a group', () => {
        it('page, or follow one another when shown more, rather than changing page', async () => {
            const list = useDataIterator(service, { groupBy: 'stage', rowLimit: 1 });

            await settle();

            const todo = groupOf(list, 'id:1');

            expect(idsOf(todo)).toEqual([1]);
            expect(todo.hasMore).toBe(true);
            expect(todo.totalPages).toBe(2);

            await todo.setPage(2);

            expect(idsOf(todo)).toEqual([2]);
            expect(service.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, size: 1 }));

            await todo.setPage(1);
            await todo.loadMore();

            expect(idsOf(todo)).toEqual([1, 2]);
            expect(todo.page).toBe(2);
            expect(todo.hasMore).toBe(false);

            const refreshing = list.refresh();

            expect(idsOf(todo)).toEqual([1, 2]);

            await refreshing;

            expect(service.list).toHaveBeenCalledWith(
                expect.objectContaining({ page: 1, size: 2, filter: ['stage', '=', 1] })
            );
            expect(idsOf(todo)).toEqual([1, 2]);
        });

        it('say their own loading and their own error, the other groups showing their rows', async () => {
            let answerDone = null;

            service.list.mockImplementation((query) => {
                if (JSON.stringify(query.filter) === JSON.stringify(['stage', '=', 2])) {
                    return new Promise((resolve, reject) => {
                        answerDone = reject;
                    });
                }

                return Promise.resolve(answer(things, query));
            });

            const list = useDataIterator(service, { groupBy: 'stage' });

            await settle();

            expect(groupOf(list, 'id:2').loading).toBe(true);
            expect(groupOf(list, 'id:1').loading).toBe(false);
            expect(list.loading.value).toBe(true);

            answerDone(new Error('Gone'));
            await settle();

            expect(groupOf(list, 'id:2').error.message).toBe('Gone');
            expect(groupOf(list, 'id:2').loading).toBe(false);
            expect(idsOf(groupOf(list, 'id:1'))).toEqual([1, 2]);
            expect(list.error.value).toBeNull();
        });

        it('go to the group of their new value when they change', async () => {
            const list = useDataIterator(service, { groupBy: 'stage' });

            await settle();

            list.upsertLocal({ id: 1, name: 'Lamp', stage: { id: 2, name: 'Done' } });

            expect(idsOf(groupOf(list, 'id:1'))).toEqual([2]);
            expect(idsOf(groupOf(list, 'id:2'))).toEqual([3, 5, 1]);
            expect(groupOf(list, 'id:1').total).toBe(1);
            expect(groupOf(list, 'id:2').total).toBe(3);

            list.upsertLocal({ id: 2, name: 'Desk again' });

            expect(list.byId(2).name).toBe('Desk again');
            expect(idsOf(groupOf(list, 'id:1'))).toEqual([2]);
        });

        it('are read again once the writes of the list are done, not while they run', async () => {
            const list = useDataIterator(service, { groupBy: 'stage' });

            await settle();

            const reads = service.list.mock.calls.length;
            let done = null;
            const write = list.writing(() => new Promise((resolve) => (done = resolve)));
            const refreshing = list.refresh();

            await settle();

            expect(service.list).toHaveBeenCalledTimes(reads);

            done();
            await write;
            await refreshing;
            await settle();

            expect(service.list).toHaveBeenCalledTimes(reads + 3);
        });
    });

    describe('moving', () => {
        it('puts a row in another group at once, then sends the order of the group with its value in one request', async () => {
            const list = useDataIterator(service, { groupBy: 'stage' });

            await settle();

            let send = null;

            dataset.resequence = vi.fn(() => new Promise((resolve) => (send = resolve)));

            const moving = list.moveTo(list.byId(1), groupOf(list, 'id:2'), 0);

            expect(idsOf(groupOf(list, 'id:1'))).toEqual([2]);
            expect(idsOf(groupOf(list, 'id:2'))).toEqual([1, 3, 5]);
            expect(groupOf(list, 'id:1').total).toBe(1);
            expect(groupOf(list, 'id:2').total).toBe(3);
            expect(list.byId(1).stage).toMatchObject({ id: 2, name: 'Done' });

            send({});
            await moving;

            expect(dataset.resequence).toHaveBeenCalledTimes(1);
            expect(dataset.resequence).toHaveBeenCalledWith('thing', [1, 3, 5], {
                sequenceField: 'sequence',
                sequenceOffset: 0,
                groupField: 'stage',
                groupValue: 2,
            });
            expect(service.update).not.toHaveBeenCalled();
        });

        it('sends the rank of the page of the group a row is moved to', async () => {
            const list = useDataIterator(service, { groupBy: 'stage', rowLimit: 1 });

            await settle();
            await groupOf(list, 'id:2').setPage(2);
            await list.moveTo(list.byId(1), groupOf(list, 'id:2'), 0);

            expect(dataset.resequence).toHaveBeenCalledWith('thing', [1, 5], {
                sequenceField: 'sequence',
                sequenceOffset: 1,
                groupField: 'stage',
                groupValue: 2,
            });
        });

        it('reads the groups again on a refusal, and throws it', async () => {
            const list = useDataIterator(service, { groupBy: 'stage' });

            await settle();

            dataset.resequence = vi.fn().mockRejectedValue(new Error('Refused'));

            await expect(list.moveTo(list.byId(1), groupOf(list, 'id:2'))).rejects.toThrow('Refused');
            await settle();

            expect(idsOf(groupOf(list, 'id:1'))).toEqual([1, 2]);
            expect(idsOf(groupOf(list, 'id:2'))).toEqual([3, 5]);
        });

        it('orders a group with no group sent', async () => {
            const list = useDataIterator(service, { groupBy: 'stage' });

            await settle();
            await list.moveTo(list.byId(5), groupOf(list, 'id:2'), 0);

            expect(idsOf(groupOf(list, 'id:2'))).toEqual([5, 3]);
            expect(dataset.resequence).toHaveBeenCalledWith('thing', [5, 3], {
                sequenceField: 'sequence',
                sequenceOffset: 0,
            });
        });

        it('writes a field of the workspace on the row, then the order without it', async () => {
            const list = useDataIterator(service, { groupBy: 'extra_size' });

            await settle();
            await list.moveTo(list.byId(1), groupOf(list, 'value:l'));

            expect(service.update).toHaveBeenCalledWith(1, { extra_size: 'l' });
            expect(dataset.resequence).toHaveBeenCalledWith('thing', [2, 1], {
                sequenceField: 'sequence',
                sequenceOffset: 0,
            });
        });

        it('writes the value alone without a manual order, and moves nothing on a read-only field', async () => {
            const list = useDataIterator(service, { groupBy: 'priority', sortable: false });

            await settle();
            await list.moveTo(list.byId(1), groupOf(list, 'value:high'));

            expect(service.update).toHaveBeenCalledWith(1, { priority: 'high' });
            expect(dataset.resequence).not.toHaveBeenCalled();
            expect(idsOf(groupOf(list, 'value:high'))).toEqual([2, 3, 1]);

            list.groupBy.value = 'kind';
            await settle();

            expect(list.canMoveToGroup.value).toBe(false);
            await expect(list.moveTo(list.byId(4), groupOf(list, 'value:a'))).rejects.toThrow();
        });

        it('puts a group of records ordered by hand in its place at once, and back on a refusal', async () => {
            const list = useDataIterator(service, { groupBy: 'stage' });

            await settle();

            expect(list.canMoveGroups.value).toBe(true);

            let send = null;
            const ordered = dataset.resequence;

            dataset.resequence = vi.fn((...args) => new Promise((resolve) => (send = () => resolve(ordered(...args)))));

            const moving = list.moveGroup(groupOf(list, 'id:2'), 0);

            expect(labels(list)).toEqual(['Done', 'To do', 'No value']);

            send();
            await moving;

            expect(dataset.resequence).toHaveBeenCalledWith('stage', [2, 1], {
                sequenceField: 'sequence',
                sequenceOffset: 0,
            });

            dataset.resequence = vi.fn().mockRejectedValue(new Error('Refused'));

            await expect(list.moveGroup(groupOf(list, 'id:1'), 0)).rejects.toThrow('Refused');
            await settle();

            expect(labels(list)).toEqual(['Done', 'To do', 'No value']);

            list.groupBy.value = 'priority';
            await settle();

            expect(list.canMoveGroups.value).toBe(false);
        });
    });

    describe('the state', () => {
        it('keeps the grouping in the url after its prefix, none written for the default one, and follows it', async () => {
            router.route = reactive({ query: {} });

            const list = useDataIterator(service, { groupBy: 'stage', url: { prefix: 'tasks_' } });

            await settle();

            expect(router.route.query).toEqual({});

            list.groupBy.value = 'priority';
            await settle();

            expect(router.route.query).toEqual({ tasks_g: 'priority' });

            list.groupBy.value = null;
            await settle();

            expect(router.route.query).toEqual({ tasks_g: 'none' });
            expect(list.items.value).toHaveLength(5);
            expect(list.groups.value).toEqual([]);

            router.route.query = { tasks_g: 'urgent' };
            await settle();

            expect(list.groupBy.value).toBe('urgent');
            expect(labels(list)).toEqual(['Yes', 'No']);

            router.route = { query: { g: 'none' } };

            const opened = useDataIterator(service, { groupBy: 'stage' });

            expect(opened.groupBy.value).toBeNull();
        });

        it('opens on the grouping of its view, saves it, applies it and tells it changed', async () => {
            const urgent = {
                id: 4,
                name: 'Urgent',
                model: 'thing',
                scope: '',
                filters: null,
                order_by: null,
                group_by: 'urgent',
                is_default: true,
                editable: true,
            };

            apis.custom_view.list.mockResolvedValue({ data: { items: [urgent], total: 1 } });
            apis.custom_view.create = vi.fn(async (payload) => ({ data: { id: 5, ...payload } }));

            const list = useDataIterator(service, { groupBy: 'stage', views: {} });

            await settle();

            expect(list.groupBy.value).toBe('urgent');
            expect(labels(list)).toEqual(['Yes', 'No']);

            const custom = useCustomViews('thing', { list });

            await custom.ensure();

            expect(custom.modified.value).toBe(false);

            list.groupBy.value = null;

            expect(custom.modified.value).toBe(true);

            await custom.create({ name: 'Flat' });

            expect(apis.custom_view.create.mock.calls[0][0]).toMatchObject({ name: 'Flat', group_by: 'none' });

            custom.apply(urgent);

            expect(list.groupBy.value).toBe('urgent');
        });

        it('leaves the grouping to a screen that keeps it in the state of its views', async () => {
            const owner = ref(null);
            const state = { group_by: { get: () => owner.value, set: (value) => (owner.value = value), key: 'group' } };

            apis.custom_view.list.mockResolvedValue({
                data: {
                    items: [{ id: 4, model: 'thing', scope: '', filters: null, group_by: 'owner', is_default: true }],
                    total: 1,
                },
            });

            const list = useDataIterator(service, { sortable: false, views: { state } });

            await settle();

            expect(owner.value).toBe('owner');
            expect(list.groupBy.value).toBeNull();
            expect(list.groups.value).toEqual([]);
            expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ filter: null }));

            const custom = useCustomViews('thing', { list });

            await custom.ensure();

            expect(custom.modified.value).toBe(false);
        });

        it('chooses every row of the groups shown, and opens a record in the filter of its group', async () => {
            const list = useDataIterator(service, { groupBy: 'priority', emptyGroup: 'none', enableSelection: true });

            await settle();

            list.selection.all = true;

            expect(list.rowsFilter.value).toEqual([
                '|',
                [
                    ['priority', '=', 'low'],
                    ['priority', '=', 'high'],
                ],
            ]);
            expect(list.selection.count).toBe(4);
            expect(JSON.parse(listContext(list, { group: list.groups.value[1] }).ctx)).toEqual({
                f: ['priority', '=', 'high'],
            });
        });

        it('starts over on its default grouping in another workspace', async () => {
            const list = useDataIterator(service, { groupBy: 'stage' });

            await settle();

            list.groupBy.value = 'priority';
            await settle();

            const reads = apis.stage.list.mock.calls.length;

            bus.trigger(RESOURCES_STALE, { since: performance.now() });
            await settle();

            expect(list.groupBy.value).toBe('stage');
            expect(labels(list)).toEqual(['To do', 'Done', 'No value']);
            expect(apis.stage.list).toHaveBeenCalledTimes(reads + 1);
        });
    });
});
