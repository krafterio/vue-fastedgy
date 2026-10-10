/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, reactive } from 'vue';
import { useDataIterator } from '../composables/data-iterator.js';
import { useRecordEdit } from '../composables/record-edit.js';

vi.mock('vue-router', () => ({
    useRoute: () => ({ query: {} }),
    useRouter: () => ({ replace: vi.fn() }),
}));

const apis = vi.hoisted(() => ({}));

vi.mock('../composables/api.js', () => ({
    useApiModel: (name) => apis[name],
}));

const metadatas = vi.hoisted(() => ({}));

vi.mock('../stores/metadata.js', () => ({
    useMetadataStore: () => ({ getMetadata: (name) => Promise.resolve(metadatas[name] ?? null) }),
}));

vi.mock('../composables/dataset.js', () => ({
    useDataset: () => ({ resequence: vi.fn() }),
}));

const settle = async () => {
    for (let turn = 0; turn < 3; turn++) {
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve));
    }
};

const field = (name, type, values = {}) => ({ name, label: name, type, readonly: false, required: false, ...values });

const refusal = (detail) => Object.assign(new Error('Unprocessable Entity'), { data: { detail } });

describe('useRecordEdit', () => {
    let scope;
    let things;
    let held;
    let refused;
    let service;

    const make = (options) => scope.run(() => useDataIterator(service, options));

    beforeEach(() => {
        scope = effectScope();
        metadatas.thing = {
            name: 'thing',
            fields: {
                name: field('name', 'char'),
                stage: field('stage', 'many2one', { target: 'stage' }),
                tags: field('tags', 'many2many', { target: 'tag' }),
                due: field('due', 'date'),
                at: field('at', 'datetime'),
            },
        };
        metadatas.stage = {
            name: 'stage',
            fields: { id: field('id', 'integer'), name: field('name', 'char') },
        };
        things = [
            { id: 1, name: 'Lamp', stage: { id: 1, name: 'To do' } },
            { id: 2, name: 'Desk', stage: { id: 2, name: 'Done' } },
        ];
        held = [];
        refused = null;

        const answer = async (run) => {
            if (held.length > 0) {
                await held.shift();
            }

            const failure = refused;

            if (failure) {
                refused = null;

                throw failure;
            }

            return run();
        };

        service = {
            modelName: 'thing',
            list: vi.fn(async (query) => {
                const stage = query.filter?.[0] === 'stage' ? query.filter[2] : undefined;
                const items = things.filter((row) => stage === undefined || (row.stage?.id ?? null) === stage);

                return { data: { items: items.map((row) => ({ ...row })), total: items.length } };
            }),
            update: vi.fn((id, body) =>
                answer(() => {
                    const row = things.find((one) => one.id === id);

                    Object.assign(row, body, typeof body.stage === 'number' ? { stage: { id: body.stage } } : {});

                    return { data: { ...row, ...(row.stage ? { stage: { ...row.stage, name: 'Done' } } : {}) } };
                })
            ),
            create: vi.fn((body) => answer(() => ({ data: { id: 100, ...body } }))),
        };
        apis.stage = {
            list: vi.fn(async () => ({
                data: {
                    items: [
                        { id: 1, name: 'To do' },
                        { id: 2, name: 'Done' },
                    ],
                    total: 2,
                },
            })),
        };
    });

    afterEach(() => scope.stop());

    it('shows a value at once, writes the id of a relation with the fields of the list, and takes the row answered', async () => {
        const list = make({ fields: ['name', 'stage'] });
        const cells = useRecordEdit(service, { list });

        await settle();

        let release = null;

        held.push(new Promise((resolve) => (release = resolve)));

        const editing = cells.edit(list.byId(1), 'stage', { id: 2, name: 'Done' });

        await settle();

        expect(list.byId(1).stage).toEqual({ id: 2, name: 'Done' });
        expect(cells.isSaving(list.byId(1), 'stage')).toBe(true);

        release();

        const saved = await editing;

        expect(service.update).toHaveBeenCalledWith(1, { stage: 2 }, { fields: ['id', 'name', 'stage'] });
        expect(list.byId(1)).toEqual(saved);
        expect(cells.isSaving(list.byId(1), 'stage')).toBe(false);
    });

    it('writes the ids of several records, a day as it is, an instant in UTC', async () => {
        const list = make({ fields: ['name'] });
        const cells = useRecordEdit(service, { list });

        await settle();
        await cells.edit(list.byId(1), 'tags', [{ id: 3, name: 'Red' }, { id: 4 }]);
        await cells.edit(list.byId(1), 'due', new Date(2026, 9, 10));
        await cells.edit(list.byId(1), 'at', new Date(Date.UTC(2026, 9, 10, 8, 30)));
        await cells.edit(list.byId(1), 'due', '2026-10-11');

        expect(service.update.mock.calls.map(([, body]) => body)).toEqual([
            { tags: [3, 4] },
            { due: '2026-10-10' },
            { at: '2026-10-10T08:30:00.000Z' },
            { due: '2026-10-11' },
        ]);
    });

    it('puts the value back on a refusal, its message kept on its cell or on its row', async () => {
        const errors = [];
        const list = make({ fields: ['name'] });
        const cells = useRecordEdit(service, { list, onError: (error) => errors.push(error) });

        await settle();

        refused = refusal([{ loc: ['body', 'name'], msg: 'Too short', type: 'value_error' }]);

        expect(await cells.edit(list.byId(1), 'name', 'L')).toBeNull();
        expect(list.byId(1).name).toBe('Lamp');
        expect(cells.errorOf(list.byId(1), 'name')).toBe('Too short');
        expect(cells.rowErrorOf(list.byId(1))).toBeNull();
        expect(errors).toHaveLength(1);

        refused = refusal('Locked');

        await cells.edit(list.byId(1), 'name', 'Lantern');

        expect(cells.rowErrorOf(list.byId(1))).toBe('Locked');
        expect(cells.errorOf(list.byId(1), 'name')).toBeNull();

        await cells.edit(list.byId(1), 'name', 'Lantern');

        expect(list.byId(1).name).toBe('Lantern');
        expect(cells.rowErrorOf(list.byId(1))).toBeNull();
    });

    it('writes nothing for a value the row holds, and holds a refresh of the list until the write is done', async () => {
        const list = make({ fields: ['name'] });
        const cells = useRecordEdit(service, { list });

        await settle();
        await cells.edit(list.byId(1), 'name', 'Lamp');

        expect(service.update).not.toHaveBeenCalled();

        let release = null;

        held.push(new Promise((resolve) => (release = resolve)));

        const editing = cells.edit(list.byId(1), 'name', 'Lantern');
        const reads = service.list.mock.calls.length;

        await settle();

        const refreshing = list.refresh();

        await settle();

        expect(service.list).toHaveBeenCalledTimes(reads);

        release();
        await editing;
        await refreshing;

        expect(service.list).toHaveBeenCalledTimes(reads + 1);
    });

    it('moves a row to the group of its new value at once', async () => {
        const list = make({ groupBy: 'stage', fields: ['name'] });
        const cells = useRecordEdit(service, { list });

        await settle();

        const editing = cells.edit(list.byId(1), 'stage', { id: 2, name: 'Done' });

        await settle();

        expect(list.groups.value[1].items.map((row) => row.id)).toEqual([2, 1]);
        expect(list.groups.value[0].items).toEqual([]);

        await editing;
    });

    it('writes through the write of the app', async () => {
        const calls = [];
        const list = make({ fields: ['name'] });
        const cells = useRecordEdit(service, {
            list,
            write: async (item, name, value) => {
                calls.push([item.id, name, value]);

                return null;
            },
        });

        await settle();
        await cells.edit(list.byId(2), 'stage', { id: 1, name: 'To do' });

        expect(calls).toEqual([[2, 'stage', 1]]);
        expect(service.update).not.toHaveBeenCalled();
        expect(list.byId(2).stage).toEqual({ id: 1, name: 'To do' });
    });

    it('creates the record of the draft at the start of the list, or keeps the messages on the draft', async () => {
        const list = make({ fields: ['name'] });
        const cells = useRecordEdit(service, { list });

        await settle();

        refused = refusal([{ loc: ['body', 'name'], msg: 'Required', type: 'missing' }]);

        expect(await cells.create({ stage: { id: 1 } })).toBeNull();
        expect(cells.errorOf(null, 'name')).toBe('Required');

        let release = null;

        held.push(new Promise((resolve) => (release = resolve)));

        const creating = cells.create({ name: 'Chair', stage: { id: 1 } });

        await settle();

        expect(cells.isSaving(null, 'name')).toBe(true);

        release();

        const created = await creating;

        expect(service.create).toHaveBeenLastCalledWith({ name: 'Chair', stage: 1 }, { fields: ['id', 'name'] });
        expect(list.items.value[0].id).toBe(created.id);
        expect(list.total.value).toBe(3);
        expect(cells.errorOf(null, 'name')).toBeNull();
    });

    it('changes in place the record it is given without a list, and puts it back on a refusal', async () => {
        const record = reactive({ id: 1, name: 'Lamp' });
        const cells = useRecordEdit(service);

        const editing = cells.edit(record, 'name', 'Lantern');

        await settle();

        expect(record.name).toBe('Lantern');

        await editing;

        expect(service.update).toHaveBeenCalledWith(1, { name: 'Lantern' }, {});

        refused = refusal('Locked');

        expect(await cells.edit(record, 'name', 'Lumen')).toBeNull();
        expect(record.name).toBe('Lantern');
        expect(cells.rowErrorOf(record)).toBe('Locked');
    });
});
