/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { bus } from '../composables/bus.js';
import { useResourceChanged } from '../composables/realtime.js';
import { notifyChanged, realtime } from '../network/realtime.js';

const mounted = [];

// The bus outlives a test: a listener left attached is heard by the next one.
function listening(setup) {
    const wrapper = mount({
        setup() {
            setup();

            return () => null;
        },
    });

    mounted.push(wrapper);

    return wrapper;
}

const change = (event) => notifyChanged({ model: 'company', action: 'updated', id: 7, ...event });
const settle = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('useResourceChanged', () => {
    let heard;

    beforeEach(() => {
        heard = [];
        realtime.disconnect();
    });

    afterEach(() => {
        mounted.splice(0).forEach((wrapper) => wrapper.unmount());
    });

    it('hears a change of the model it watches', async () => {
        listening(() => useResourceChanged('company', (one) => heard.push(one), { refreshDelay: 0 }));
        change({});

        expect(heard).toHaveLength(1);
        expect(heard[0].model).toBe('company');
    });

    it('leaves another model alone', () => {
        listening(() => useResourceChanged('company', (one) => heard.push(one), { refreshDelay: 0 }));
        change({ model: 'contact' });

        expect(heard).toEqual([]);
    });

    it('leaves another record alone when it watches one', () => {
        listening(() => useResourceChanged('company', (one) => heard.push(one), { id: 7, refreshDelay: 0 }));
        change({ id: 9 });
        change({ id: 7 });

        expect(heard).toHaveLength(1);
    });

    it('follows the record it was given as a getter', () => {
        const id = ref(7);

        listening(() =>
            useResourceChanged('company', (one) => heard.push(one), { id: () => id.value, refreshDelay: 0 })
        );
        change({ id: 9 });

        expect(heard).toEqual([]);
    });

    it('collapses a burst into one call', async () => {
        listening(() => useResourceChanged('company', (one) => heard.push(one), { refreshDelay: 20 }));

        for (let index = 0; index < 5; index++) {
            change({});
        }

        await settle(50);

        expect(heard).toHaveLength(1);
    });

    it('leaves alone an update that moved nothing it reads', async () => {
        listening(() =>
            useResourceChanged('company', (one) => heard.push(one), { watchFields: ['name'], refreshDelay: 0 })
        );
        change({ changed: ['internal_note'] });

        expect(heard).toEqual([]);
    });

    it('hears a create whatever its columns', () => {
        listening(() =>
            useResourceChanged('company', (one) => heard.push(one), { watchFields: ['name'], refreshDelay: 0 })
        );
        change({ action: 'created', changed: ['internal_note'] });

        expect(heard).toHaveLength(1);
    });

    it('asks the view to read again when the socket comes back, without waiting', () => {
        listening(() => useResourceChanged('company', (one) => heard.push(one), { refreshDelay: 5000 }));
        bus.trigger('realtime:reconnected', {});

        expect(heard).toHaveLength(1);
        expect(heard[0].action).toBe('reconnected');
    });

    it('subscribes the socket to what it watches, and lets go when the view does', () => {
        const subscribe = vi.spyOn(realtime, 'subscribe');
        const unsubscribe = vi.spyOn(realtime, 'unsubscribe');

        const wrapper = listening(() => useResourceChanged('company', () => {}, { id: 7 }));

        expect(subscribe).toHaveBeenCalledWith('company', 7);

        wrapper.unmount();

        expect(unsubscribe).toHaveBeenCalledWith('company', 7);

        subscribe.mockRestore();
        unsubscribe.mockRestore();
    });
});
