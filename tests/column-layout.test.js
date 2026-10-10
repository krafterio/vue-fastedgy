/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick } from 'vue';
import { columnEntry, defaultColumnWidth, readColumnEntry, useColumnLayout } from '../composables/column-layout.js';
import { useCustomViews } from '../composables/custom-views.js';
import { useDataTable } from '../composables/data-table.js';

vi.mock('vue-router', () => ({
    useRoute: () => ({ query: {} }),
    useRouter: () => ({ replace: vi.fn() }),
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
    useMetadataStore: () => ({
        getMetadata: (name) => Promise.resolve(metadatas[name] ?? null),
        getMetadatas: () => Promise.resolve(metadatas),
    }),
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

const field = (name, type, label = name) => ({ name, label, type, readonly: false, required: false });

/** Whether a custom view holds under the rules of a read: `=` and `is true`, all applying. */
const holds = (view, filter) =>
    (filter ?? []).every(([name, operator, value]) =>
        operator === 'is true' ? view[name] === true : (view[name] ?? '') === value
    );

describe('the columns a list shows', () => {
    let scope;
    let views;
    let service;

    const keys = (table) => table.columns.value.map((column) => column.key);
    // The writes of the custom views, in the order they went.
    const layoutWrites = () =>
        ['create', 'update', 'delete']
            .flatMap((action) =>
                apis.custom_view[action].mock.calls.map((args, index) => ({
                    at: apis.custom_view[action].mock.invocationCallOrder[index],
                    call: [action, ...args.slice(0, action === 'create' ? 1 : action === 'update' ? 2 : 1)],
                }))
            )
            .sort((one, other) => one.at - other.at)
            .map((one) => one.call);
    const addView = (values) => {
        const view = { id: views.length + 1, model: 'thing', scope: '', user: null, editable: true, ...values };

        views.push(view);

        return view;
    };
    const tableOf = (options = {}) =>
        scope.run(() => {
            const table = useDataTable(service, {
                columns: [{ key: 'name', width: 300 }, { key: 'status' }],
                ...options,
            });

            useColumnLayout(service, { table, declared: ['name', 'status'] });

            return table;
        });
    const layoutOf = (options = {}) =>
        scope.run(() =>
            useColumnLayout(service, {
                declared: ['name', 'status'],
                locked: ['name'],
                exclude: ['code'],
                delay: 20,
                ...options,
            })
        );

    beforeEach(() => {
        scope = effectScope();
        views = [];
        metadatas.thing = {
            name: 'thing',
            fields: {
                name: field('name', 'char', 'Name'),
                status: field('status', 'choice', 'Status'),
                notes: field('notes', 'text', 'Notes'),
                owner: field('owner', 'many2one', 'Owner'),
                code: field('code', 'char'),
                sequence: field('sequence', 'integer'),
                files: field('files', 'one2many'),
            },
        };
        service = {
            modelName: 'thing',
            prefix: '/acme',
            list: vi.fn().mockResolvedValue({ data: { items: [{ id: 1 }], total: 1 } }),
        };
        apis.custom_view = {
            list: vi.fn(async (query) => ({
                data: { items: views.filter((view) => holds(view, query.filter)), total: views.length },
            })),
            get: vi.fn(async (id) => ({ data: views.find((view) => view.id === id) })),
            create: vi.fn(async (body) => ({ data: addView(body) })),
            update: vi.fn(async (id, body) => {
                const view = views.find((one) => one.id === id);

                Object.assign(view, body);

                return { data: { ...view } };
            }),
            delete: vi.fn(async (id) => {
                views = views.filter((view) => view.id !== id);
            }),
        };
        apis.custom_view_favorite = { list: vi.fn().mockResolvedValue({ data: { items: [], total: 0 } }) };
    });

    afterEach(() => scope.stop());

    it('reads an entry as display_fields keeps it, a width by default being none', () => {
        expect(readColumnEntry('status')).toEqual({ name: 'status', width: null });
        expect(readColumnEntry({ name: 'status', width: 280 })).toEqual({ name: 'status', width: 280 });
        expect(readColumnEntry({ name: 'status', width: defaultColumnWidth })).toEqual({ name: 'status', width: null });
        expect(readColumnEntry({ width: 280 })).toBeNull();
        expect(columnEntry('status', 280)).toEqual({ name: 'status', width: 280 });
        expect(columnEntry('status', defaultColumnWidth)).toBe('status');
    });

    describe('the layout read', () => {
        it('is the one of the user, else the one of everyone, else the columns declared', async () => {
            const declared = tableOf();

            await settle();

            expect(keys(declared)).toEqual(['name', 'status']);
            expect(service.list).toHaveBeenLastCalledWith(
                expect.objectContaining({ fields: ['id', 'name', 'status'] })
            );
            expect(apis.custom_view.list.mock.calls[0][0]).toEqual({
                size: 10,
                fields: 'id,user,display_fields,editable',
                filter: [
                    ['model', '=', 'thing'],
                    ['scope', '=', 'layout'],
                ],
            });

            addView({ scope: 'layout', display_fields: ['status', { name: 'name', width: 280 }] });

            const shared = tableOf();

            await settle();

            expect(keys(shared)).toEqual(['status', 'name']);
            expect(shared.columns.value[1].width).toBe(280);
            expect(service.list).toHaveBeenLastCalledWith(
                expect.objectContaining({ fields: ['id', 'status', 'name'] })
            );

            addView({ scope: 'layout', user: { id: 5 }, display_fields: ['notes', 'gone'] });

            const own = tableOf();

            await settle();

            expect(keys(own)).toEqual(['notes']);
            expect(own.columns.value[0]).toMatchObject({ key: 'notes', label: 'Notes', type: 'text' });
            expect(service.list).toHaveBeenLastCalledWith(expect.objectContaining({ fields: ['id', 'notes'] }));
        });

        it('keeps a locked column, and offers the fields a column shows', async () => {
            addView({ scope: 'layout', user: { id: 5 }, display_fields: ['status'] });

            const layout = layoutOf();

            await layout.ready;

            expect(layout.entries.value.map((entry) => entry.name)).toEqual(['name', 'status']);
            expect(layout.available.value.map((one) => one.name)).toEqual(['notes', 'owner']);
        });

        it('is kept under the scope of its list', async () => {
            const layout = layoutOf({ scope: 'collection:7' });

            await layout.ready;

            expect(apis.custom_view.list.mock.calls[0][0].filter).toEqual([
                ['model', '=', 'thing'],
                ['scope', '=', 'layout:collection:7'],
            ]);
        });
    });

    describe('a change', () => {
        it('shows at once and is written once a burst of them is over', async () => {
            const layout = layoutOf();

            await layout.ready;

            vi.useFakeTimers();

            layout.show('notes', { at: 0 });
            layout.resize('notes', 120);
            layout.move('status', 0);
            layout.hide('name');
            layout.resize('name', 120);

            expect(layout.entries.value).toEqual([
                { name: 'status', width: null },
                { name: 'notes', width: 120 },
                { name: 'name', width: null },
            ]);
            expect(layoutWrites()).toEqual([]);

            await vi.advanceTimersByTimeAsync(20);

            expect(layoutWrites()).toEqual([
                [
                    'create',
                    {
                        name: 'List columns',
                        model: 'thing',
                        scope: 'layout',
                        user: 5,
                        display_fields: ['status', { name: 'notes', width: 120 }, 'name'],
                    },
                ],
            ]);

            layout.resize('notes', defaultColumnWidth);

            expect(layout.entries.value[1]).toEqual({ name: 'notes', width: null });

            await vi.advanceTimersByTimeAsync(20);
            vi.useRealTimers();

            expect(layoutWrites().at(-1)).toEqual(['update', 1, { display_fields: ['status', 'notes', 'name'] }]);
        });

        it('goes back to the layout of everyone, the one of the user deleted, and is shared by who may', async () => {
            const everyone = addView({ scope: 'layout', display_fields: ['status'], editable: false });

            addView({ scope: 'layout', user: { id: 5 }, display_fields: ['notes'] });

            const layout = layoutOf();

            await layout.ready;

            expect(layout.canShare.value).toBe(false);
            expect(layout.entries.value.at(-1)).toEqual({ name: 'notes', width: null });

            await layout.reset();

            expect(layoutWrites()).toEqual([['delete', 2]]);
            expect(layout.entries.value).toEqual([
                { name: 'name', width: null },
                { name: 'status', width: null },
            ]);

            everyone.editable = true;
            await layout.load();

            expect(layout.canShare.value).toBe(true);

            await layout.shareAsDefault();

            expect(layoutWrites().at(-1)).toEqual(['update', 1, { display_fields: ['name', 'status'] }]);
        });

        it('is kept in a store of the app, which shares nothing', async () => {
            const kept = [];
            const layout = layoutOf({
                store: { read: async () => ['status'], write: async (entries) => kept.push(entries) },
            });

            await layout.ready;

            expect(layout.entries.value.map((entry) => entry.name)).toEqual(['name', 'status']);
            expect(layout.canShare.value).toBe(false);

            layout.hide('status');
            await new Promise((resolve) => setTimeout(resolve, 40));

            expect(kept).toEqual([['name']]);

            await layout.reset();

            expect(kept.at(-1)).toEqual(['name', 'status']);
            expect(apis.custom_view.list).not.toHaveBeenCalled();
            expect(layoutWrites()).toEqual([]);
        });

        it('keeps what the last write failed with', async () => {
            apis.custom_view.create = vi.fn().mockRejectedValue(new Error('Refused'));

            const layout = layoutOf();

            await layout.ready;
            layout.show('notes');
            await new Promise((resolve) => setTimeout(resolve, 40));

            expect(layout.error.value.message).toBe('Refused');
            expect(layout.entries.value.at(-1)).toEqual({ name: 'notes', width: null });
        });

        it('reads the rows again for a column it has not read, not for one removed', async () => {
            const table = tableOf();

            await settle();

            const reads = service.list.mock.calls.length;

            table.layout.value.show('notes');
            await settle();

            expect(service.list).toHaveBeenCalledTimes(reads + 1);
            expect(service.list).toHaveBeenLastCalledWith(
                expect.objectContaining({ fields: ['id', 'name', 'status', 'notes'] })
            );

            table.layout.value.hide('status');
            await settle();

            expect(service.list).toHaveBeenCalledTimes(reads + 1);
            expect(keys(table)).toEqual(['name', 'notes']);
        });
    });

    describe('a view', () => {
        it('carries its columns: saved, shown, changed as the view, and a view without any leaves the layout', async () => {
            const mine = addView({ name: 'Mine', display_fields: ['status'] });
            const bare = addView({ name: 'Bare' });
            const table = tableOf({ views: {} });
            const custom = useCustomViews('thing', { list: table });

            await settle();
            await custom.ensure();

            custom.apply(mine);
            await settle();

            expect(keys(table)).toEqual(['status']);
            expect(custom.modified.value).toBe(false);

            table.layout.value.show('notes');

            expect(keys(table)).toEqual(['status', 'notes']);
            expect(custom.modified.value).toBe(true);

            await new Promise((resolve) => setTimeout(resolve, 600));

            expect(layoutWrites()).toEqual([]);

            await custom.save(custom.current.value);

            expect(mine.display_fields).toEqual(['status', 'notes']);

            custom.apply(bare);
            await settle();

            expect(keys(table)).toEqual(['name', 'status']);

            table.layout.value.hide('status');

            expect(custom.modified.value).toBe(false);
        });
    });
});
