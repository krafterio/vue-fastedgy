/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { bus } from '../composables/bus.js';
import { useApiForm, useApiModel } from '../composables/api.js';
import { realtime, RESOURCE_CHANGED } from '../network/realtime.js';
import { useMetadataStore } from '../stores/metadata.js';
import { ORIGIN_HEADER, originId } from '../utils/origin.js';

const record = (data) => Promise.resolve({ data });

describe('useApiForm', () => {
    let api;

    beforeEach(() => {
        api = {
            create: vi.fn(() => record({ id: 7, name: 'Krafter' })),
            update: vi.fn(() => record({ id: 7, name: 'Krafter SAS' })),
            delete: vi.fn(() => Promise.resolve()),
        };
    });

    it('creates a record that has no id', async () => {
        const { save } = useApiForm(api);

        const saved = await save(null, { name: 'Krafter' });

        expect(api.create).toHaveBeenCalledWith({ name: 'Krafter' }, {});
        expect(api.update).not.toHaveBeenCalled();
        expect(saved).toEqual({ id: 7, name: 'Krafter' });
    });

    it('updates a record that has one', async () => {
        const { save } = useApiForm(api, { fields: ['name'] });

        const saved = await save(7, { name: 'Krafter SAS' });

        expect(api.update).toHaveBeenCalledWith(7, { name: 'Krafter SAS' }, { fields: ['name'] });
        expect(saved).toEqual({ id: 7, name: 'Krafter SAS' });
    });

    it('says while it writes, and not twice at once', async () => {
        const { saving, save } = useApiForm(api);

        const first = save(null, { name: 'Krafter' });

        expect(saving.value).toBe(true);

        await save(null, { name: 'Another' });
        await first;

        expect(api.create).toHaveBeenCalledTimes(1);
        expect(saving.value).toBe(false);
    });

    it('deletes the record it is pointed at', async () => {
        const { remove } = useApiForm(api);

        await remove(7);

        expect(api.delete).toHaveBeenCalledWith(7);
    });
});

describe('useApiModel action', () => {
    it('addresses an endpoint of the model that its generated routes do not cover', async () => {
        setActivePinia(createPinia());
        useMetadataStore().setMetadatas({ aliment: { name: 'aliment', api_name: 'aliments' } });

        const fetchSpy = vi.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({ started: true }),
            })
        );

        window.fetch = fetchSpy;

        const { action } = useApiModel('aliment', { prefix: '/console' });
        const response = await action('post', '/7/generate-image', { format: 'webp' });

        const [url, options] = fetchSpy.mock.calls[0];

        expect(url).toBe('/console/aliments/7/generate-image');
        expect(options.method).toBe('POST');
        expect(JSON.parse(options.body)).toEqual({ format: 'webp' });
        expect(response.data).toEqual({ started: true });
    });
});

describe('useApiModel list', () => {
    it('sends no filter for a list of no rule', async () => {
        setActivePinia(createPinia());
        useMetadataStore().setMetadatas({ aliment: { name: 'aliment', api_name: 'aliments' } });

        const fetchSpy = vi.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({ items: [], total: 0 }),
            })
        );

        window.fetch = fetchSpy;

        const { list } = useApiModel('aliment');

        await list({ filter: [] });
        await list({ filter: [['name', '=', 'pomme']] });

        expect(new Headers(fetchSpy.mock.calls[0][1].headers).has('X-Filter')).toBe(false);
        expect(new Headers(fetchSpy.mock.calls[1][1].headers).get('X-Filter')).toBe('[["name","=","pomme"]]');
    });
});

describe('useApiModel writes', () => {
    let fetchSpy;

    beforeEach(() => {
        setActivePinia(createPinia());
        useMetadataStore().setMetadatas({ aliment: { name: 'aliment', api_name: 'aliments' } });

        fetchSpy = vi.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({ id: 12, name: 'Pomme' }),
            })
        );

        window.fetch = fetchSpy;
    });

    it('stamps a request origin of its own, and expects its echo before the request leaves', async () => {
        const expectSpy = vi.spyOn(realtime, 'expect');

        await useApiModel('aliment').update(12, { name: 'Pomme' });

        const origin = new Headers(fetchSpy.mock.calls[0][1].headers).get(ORIGIN_HEADER);

        expect(origin).toMatch(new RegExp(`^${originId}\\.\\d+$`));
        expect(expectSpy).toHaveBeenCalledWith(origin, 'aliment', 12);
        expect(expectSpy.mock.invocationCallOrder[0]).toBeLessThan(fetchSpy.mock.invocationCallOrder[0]);

        expectSpy.mockRestore();
    });

    it('announces the id of the record it created', async () => {
        const heard = [];
        const listener = (event) => heard.push(event.detail);

        bus.addEventListener(RESOURCE_CHANGED, listener);
        await useApiModel('aliment').create({ name: 'Pomme' });
        bus.removeEventListener(RESOURCE_CHANGED, listener);

        expect(heard[0]).toMatchObject({ model: 'aliment', id: 12, action: 'created', announced: false });
    });
});
