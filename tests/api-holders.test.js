/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useApiCollection, useApiRecord, useApiSiblings } from '../composables/realtime.js';
import { notifyChanged } from '../network/realtime.js';

function harness(setup) {
    let held = null;
    const wrapper = mount({
        setup() {
            held = setup();

            return () => null;
        },
    });

    return { held: () => held, wrapper };
}

const change = (event) => notifyChanged({ model: 'company', origin: 'another-tab', ...event });

describe('useApiRecord', () => {
    let get;

    beforeEach(() => {
        get = vi.fn().mockResolvedValue({ data: { id: 7, name: 'Krafter' } });
    });

    it('reads the record it is pointed at', async () => {
        const { held } = harness(() => useApiRecord('company', 7, { api: { get } }));

        await flushPromises();

        expect(held().data.value).toEqual({ id: 7, name: 'Krafter' });
        expect(held().status.value).toBe('success');
    });

    it('re-reads itself when the record moves elsewhere', async () => {
        const { held } = harness(() => useApiRecord('company', 7, { api: { get } }));

        await flushPromises();
        get.mockResolvedValue({ data: { id: 7, name: 'Krafter SAS' } });
        change({ id: 7, action: 'updated' });
        await flushPromises();

        expect(held().data.value.name).toBe('Krafter SAS');
    });

    it('leaves a write on another record alone', async () => {
        const { held } = harness(() => useApiRecord('company', 7, { api: { get } }));

        await flushPromises();
        change({ id: 9, action: 'updated' });
        await flushPromises();

        expect(get).toHaveBeenCalledTimes(1);
        expect(held().isDeleted.value).toBe(false);
    });

    it('says the record is gone so the screen can close itself', async () => {
        const { held } = harness(() => useApiRecord('company', 7, { api: { get } }));

        await flushPromises();
        change({ id: 7, action: 'deleted' });
        await flushPromises();

        expect(held().isDeleted.value).toBe(true);
        expect(held().data.value).toBeNull();
    });

    it('follows the id it was given as a getter', async () => {
        const id = ref(7);
        const { held } = harness(() => useApiRecord('company', () => id.value, { api: { get } }));

        await flushPromises();
        get.mockResolvedValue({ data: { id: 9, name: 'Studio Nord' } });
        id.value = 9;
        await flushPromises();

        expect(held().data.value.id).toBe(9);
    });
});

describe('useApiCollection', () => {
    let list;

    beforeEach(() => {
        list = vi.fn().mockResolvedValue({ data: { items: [{ id: 7 }, { id: 9 }], total: 2 } });
    });

    it('drops a deleted row without going back to the server', async () => {
        const { held } = harness(() => useApiCollection('company', { fields: 'id,name' }, { api: { list } }));

        await flushPromises();
        change({ id: 7, action: 'deleted' });
        await flushPromises();

        expect(held().items.value).toEqual([{ id: 9 }]);
        expect(held().total.value).toBe(1);
        expect(list).toHaveBeenCalledTimes(1);
    });

    it('leaves alone an update that moved nothing it reads', async () => {
        const { held } = harness(() =>
            useApiCollection('company', { fields: 'id,name' }, { api: { list }, refreshDelay: 0 })
        );

        await flushPromises();
        change({ id: 7, action: 'updated', changed: ['internal_note'] });
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(list).toHaveBeenCalledTimes(1);
        expect(held().status.value).toBe('success');
    });

    it('re-reads on an update that moved what it shows', async () => {
        harness(() => useApiCollection('company', { fields: 'id,name' }, { api: { list }, refreshDelay: 0 }));

        await flushPromises();
        change({ id: 7, action: 'updated', changed: ['name'] });
        await new Promise((resolve) => setTimeout(resolve, 10));
        await flushPromises();

        expect(list).toHaveBeenCalledTimes(2);
    });

    it('collapses a burst of writes into one read', async () => {
        harness(() => useApiCollection('company', { fields: 'id,name' }, { api: { list }, refreshDelay: 20 }));

        await flushPromises();

        for (let index = 0; index < 5; index++) {
            change({ id: 7, action: 'updated', changed: ['name'] });
        }

        await new Promise((resolve) => setTimeout(resolve, 60));
        await flushPromises();

        expect(list).toHaveBeenCalledTimes(2);
    });

    it('re-reads on a create, whatever its columns', async () => {
        harness(() => useApiCollection('company', { fields: 'id,name' }, { api: { list }, refreshDelay: 0 }));

        await flushPromises();
        change({ id: 42, action: 'created', changed: ['internal_note'] });
        await new Promise((resolve) => setTimeout(resolve, 10));
        await flushPromises();

        expect(list).toHaveBeenCalledTimes(2);
    });
});

describe('useApiSiblings', () => {
    let siblings;

    beforeEach(() => {
        siblings = vi.fn().mockResolvedValue({ data: { previous: 5, next: 9 } });
    });

    it('asks for the neighbours in the list it is given', async () => {
        const query = { filter: ['status', '=', 3], orderBy: 'name:asc' };
        const { held } = harness(() => useApiSiblings('company', 7, query, { api: { siblings } }));

        await flushPromises();

        expect(siblings).toHaveBeenCalledWith(7, query);
        expect(held().previous.value).toBe(5);
        expect(held().next.value).toBe(9);
        expect(held().status.value).toBe('success');
    });

    it('follows the id once per step', async () => {
        const id = ref(7);
        harness(() =>
            useApiSiblings(
                'company',
                () => id.value,
                () => ({ orderBy: 'name:asc' }),
                { api: { siblings } }
            )
        );

        await flushPromises();
        id.value = 9;
        await flushPromises();

        expect(siblings).toHaveBeenCalledTimes(2);
        expect(siblings).toHaveBeenLastCalledWith(9, { orderBy: 'name:asc' });
    });

    it('keeps the answer of the last id asked when an earlier one lands after it', async () => {
        const id = ref(7);
        let answerFirst;

        siblings.mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)));
        siblings.mockResolvedValueOnce({ data: { previous: 7, next: 11 } });

        const { held } = harness(() => useApiSiblings('company', () => id.value, {}, { api: { siblings } }));

        id.value = 9;
        await flushPromises();
        answerFirst({ data: { previous: 5, next: 9 } });
        await flushPromises();

        expect(held().previous.value).toBe(7);
        expect(held().next.value).toBe(11);
    });

    it('re-reads when the model changes anywhere', async () => {
        harness(() => useApiSiblings('company', 7, {}, { api: { siblings }, refreshDelay: 0 }));

        await flushPromises();
        change({ id: 42, action: 'created' });
        await new Promise((resolve) => setTimeout(resolve, 10));
        await flushPromises();

        expect(siblings).toHaveBeenCalledTimes(2);
    });

    it('holds nothing without an id', async () => {
        const { held } = harness(() => useApiSiblings('company', () => null, {}, { api: { siblings } }));

        await flushPromises();

        expect(siblings).not.toHaveBeenCalled();
        expect(held().status.value).toBe('idle');
    });
});
