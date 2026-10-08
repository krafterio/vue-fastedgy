/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useCustomViews, useOpeningView } from '../composables/custom-views.js';

const apis = vi.hoisted(() => ({}));

vi.mock('../composables/api.js', () => ({
    useApiModel: (name) => apis[name],
}));

vi.mock('../stores/auth.js', () => ({
    useAuthStore: () => ({ user: { id: 5 } }),
}));

const page = (items) => ({ data: { items, total: items.length } });

const view = (id, values = {}) => ({
    id,
    name: `View ${id}`,
    model: 'household',
    scope: '',
    user: null,
    filters: null,
    order_by: null,
    is_default: false,
    editable: true,
    ...values,
});

const iterator = () => ({
    expression: ref(null),
    orderBy: ref(['created_at:desc']),
    view: ref(null),
    viewExpression: ref(undefined),
    defaultOrderBy: ['created_at:desc'],
});

beforeEach(() => {
    apis.custom_view = { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
    apis.custom_view_favorite = { list: vi.fn().mockResolvedValue(page([])), create: vi.fn(), delete: vi.fn() };
});

describe('useCustomViews', () => {
    it('reads the views of its list once, and the favorite of the user', async () => {
        apis.custom_view.list.mockResolvedValue(page([view(1), view(2)]));
        apis.custom_view_favorite.list.mockResolvedValue(page([{ id: 9, view: { id: 2 } }]));
        const views = useCustomViews('household', { prefix: '/console', list: iterator() });

        await Promise.all([views.ensure(), views.ensure()]);
        await views.ensure();

        expect(apis.custom_view.list).toHaveBeenCalledTimes(1);
        expect(apis.custom_view.list.mock.calls[0][0].filter).toEqual([
            ['model', '=', 'household'],
            ['scope', '=', ''],
        ]);
        expect(views.items.value.map((one) => one.id)).toEqual([1, 2]);
        expect(views.favorite.value).toBe(2);
    });

    it('applies a view to its list and tells when the list moves away from it', async () => {
        const list = iterator();
        apis.custom_view.list.mockResolvedValue(page([view(1, { filters: ['plan', '=', 'plus'] })]));
        const views = useCustomViews('household', { list });

        await views.ensure();
        views.apply(views.items.value[0]);

        expect(list.expression.value).toEqual(['plan', '=', 'plus']);
        expect(list.orderBy.value).toEqual(['created_at:desc']);
        expect(views.current.value.id).toBe(1);
        expect(views.modified.value).toBe(false);

        list.expression.value = ['plan', '=', 'free'];

        expect(views.modified.value).toBe(true);
    });

    it('saves what the list shows, shared or for the user alone', async () => {
        const list = iterator();
        list.expression.value = ['name', 'icontains', 'du'];
        apis.custom_view.list.mockResolvedValue(page([]));
        apis.custom_view.create.mockImplementation((payload) => Promise.resolve({ data: view(3, payload) }));
        const views = useCustomViews('household', { list });

        await views.create({ name: 'Mine', shared: false });
        await views.create({ name: 'Ours' });

        expect(apis.custom_view.create.mock.calls.map(([payload]) => payload.user)).toEqual([5, null]);
        expect(apis.custom_view.create.mock.calls[0][0]).toMatchObject({
            name: 'Mine',
            model: 'household',
            filters: ['name', 'icontains', 'du'],
            order_by: ['created_at:desc'],
        });
        expect(list.view.value).toBe(3);
    });

    it('leaves the scope of the default list to the server, and names any other', async () => {
        apis.custom_view.create.mockImplementation((payload) => Promise.resolve({ data: view(4, payload) }));

        await useCustomViews('household', { list: iterator() }).create({ name: 'All' });
        await useCustomViews('support_ticket', { scope: 'survey', list: iterator() }).create({ name: 'Surveys' });

        expect(apis.custom_view.create.mock.calls[0][0]).not.toHaveProperty('scope');
        expect(apis.custom_view.create.mock.calls[1][0]).toMatchObject({ scope: 'survey' });
    });

    it('keeps one default for everyone, one favorite for the user, and lets the deleted view go', async () => {
        const list = iterator();
        apis.custom_view.list.mockResolvedValue(page([view(1, { is_default: true }), view(2)]));
        apis.custom_view.update.mockImplementation((id, payload) => Promise.resolve({ data: view(id, payload) }));
        apis.custom_view_favorite.create.mockResolvedValue({ data: { id: 11, view: { id: 2 } } });
        const views = useCustomViews('household', { list });

        await views.ensure();
        await views.setDefault(views.items.value[1], true);

        expect(views.items.value.map((one) => one.is_default)).toEqual([false, true]);

        await views.setFavorite(views.items.value[1], true);
        expect(views.favorite.value).toBe(2);

        await views.setFavorite(views.items.value[1], false);
        expect(apis.custom_view_favorite.delete).toHaveBeenCalledWith(11);
        expect(views.favorite.value).toBeNull();

        list.view.value = 1;
        await views.remove(views.items.value[0]);

        expect(views.items.value.map((one) => one.id)).toEqual([2]);
        expect(list.view.value).toBeNull();
    });

    it('lets an error of the server reach whoever saves', async () => {
        apis.custom_view.create.mockRejectedValue(new Error('A view of this list already has this name'));
        const views = useCustomViews('household', { list: iterator() });

        await expect(views.create({ name: 'Taken' })).rejects.toThrow('already has this name');
    });

    it('tells the list the filters of the view it is on, as they are applied, saved and dropped', async () => {
        const list = iterator();
        apis.custom_view.list.mockResolvedValue(page([view(1, { filters: ['plan', '=', 'plus'] })]));
        apis.custom_view.update.mockImplementation((id, payload) => Promise.resolve({ data: view(id, payload) }));
        const views = useCustomViews('household', { list });

        await views.ensure();
        views.apply(views.items.value[0]);
        expect(list.viewExpression.value).toEqual(['plan', '=', 'plus']);

        list.expression.value = ['plan', '=', 'free'];
        await views.save(views.items.value[0]);
        expect(list.viewExpression.value).toEqual(['plan', '=', 'free']);

        await views.remove(views.items.value[0]);
        expect(list.viewExpression.value).toBeUndefined();
    });
});

describe('useOpeningView', () => {
    it('opens on the favorite of the user before the one of everyone', async () => {
        apis.custom_view.list.mockResolvedValue(page([view(1, { is_default: true })]));
        apis.custom_view_favorite.list.mockResolvedValue(page([{ id: 9, view: view(2) }]));

        const opening = useOpeningView('household');
        await opening.promise;

        expect(opening.ready.value).toBe(true);
        expect(opening.view.value.id).toBe(2);
    });

    it('falls back on the one of everyone, and reads nothing when the list already says what it shows', async () => {
        apis.custom_view.list.mockResolvedValue(page([view(1, { is_default: true })]));

        const opening = useOpeningView('household');
        await opening.promise;

        expect(opening.view.value.id).toBe(1);

        const skipped = useOpeningView('household', { skip: () => true });
        await skipped.promise;

        expect(skipped.view.value).toBeNull();
        expect(apis.custom_view.list).toHaveBeenCalledTimes(1);
    });
});
