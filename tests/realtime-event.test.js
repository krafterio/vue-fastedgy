/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../composables/bus.js';
import { useRealtimeEvent } from '../composables/realtime.js';

const mounted = [];

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

describe('useRealtimeEvent', () => {
    afterEach(() => {
        mounted.splice(0).forEach((wrapper) => wrapper.unmount());
    });

    it('hands the handler the payload and what rides beside it', () => {
        const heard = [];

        listening(() => useRealtimeEvent('import.finished', (data, meta) => heard.push({ data, meta })));
        bus.trigger('import.finished', { data: { rows: 12 }, changed: null, origin: 'another-tab', truncated: false });

        expect(heard).toEqual([
            { data: { rows: 12 }, meta: { changed: null, origin: 'another-tab', truncated: false } },
        ]);
    });

    it('tells the handler the server left the payload behind', () => {
        const heard = [];

        listening(() => useRealtimeEvent('import.finished', (data, meta) => heard.push({ data, meta })));
        bus.trigger('import.finished', { data: null, changed: null, origin: null, truncated: true });

        expect(heard).toEqual([{ data: null, meta: { changed: null, origin: null, truncated: true } }]);
    });

    it('stops hearing once the view is gone', () => {
        const heard = [];
        const wrapper = listening(() => useRealtimeEvent('import.finished', (data) => heard.push(data)));

        wrapper.unmount();
        mounted.splice(0);
        bus.trigger('import.finished', { data: { rows: 1 } });

        expect(heard).toEqual([]);
    });
});
