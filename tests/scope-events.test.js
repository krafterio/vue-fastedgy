/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref, toValue } from 'vue';
import { bus } from '../composables/bus.js';
import { REALTIME_SOURCE, REALTIME_SOURCE_REQUEST, useRealtime } from '../composables/realtime.js';
import { METADATA_INVALIDATED, useMetadataStore } from '../stores/metadata.js';
import { realtime } from '../network/realtime.js';
import { useWorkspaceStore } from '../stores/workspace.js';

const mounted = [];

function shell(setup) {
    const wrapper = mount({
        setup() {
            setup();

            return () => null;
        },
    });

    mounted.push(wrapper);

    return wrapper;
}

const tokenExpiringIn = (seconds) =>
    `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }))}.signature`;

describe('the scope a socket reads', () => {
    let connect;

    beforeEach(() => {
        setActivePinia(createPinia());
        localStorage.setItem('access_token', tokenExpiringIn(600));
        localStorage.setItem('refresh_token', 'the-refresh-token');
        realtime.disconnect();
        connect = vi.spyOn(realtime, 'connect').mockImplementation(() => {});
    });

    afterEach(() => {
        mounted.splice(0).forEach((wrapper) => wrapper.unmount());
        vi.restoreAllMocks();
    });

    it('opens on the scope announced on the bus', async () => {
        const scope = ref(null);

        shell(() => useRealtime());
        bus.trigger(REALTIME_SOURCE, { source: scope });
        scope.value = 'studio-nord';
        await Promise.resolve();

        expect(connect).toHaveBeenLastCalledWith(expect.any(String), 'studio-nord');
    });

    it('asks for a scope announced before it started', async () => {
        const answer = (event) => (event.detail.source = () => 'studio-nord');

        bus.addEventListener(REALTIME_SOURCE_REQUEST, answer);
        shell(() => useRealtime());
        await Promise.resolve();
        await Promise.resolve();
        bus.removeEventListener(REALTIME_SOURCE_REQUEST, answer);

        expect(connect).toHaveBeenLastCalledWith(expect.any(String), 'studio-nord');
    });

    it('opens on nothing when nobody scopes it', () => {
        shell(() => useRealtime());

        expect(connect).toHaveBeenLastCalledWith(expect.any(String), null);
    });
});

describe('the metadatas a tenant declares', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        localStorage.setItem('access_token', tokenExpiringIn(600));
        localStorage.setItem('refresh_token', 'the-refresh-token');
    });

    it('reads them again once they are said to be stale', async () => {
        const store = useMetadataStore();
        const reads = vi.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({ company: { fields: {} } }),
            })
        );

        window.fetch = reads;

        await store.getMetadatas();
        await store.getMetadatas();

        expect(reads).toHaveBeenCalledTimes(1);

        bus.trigger(METADATA_INVALIDATED);
        await store.getMetadatas();

        expect(reads).toHaveBeenCalledTimes(2);
    });

    it('drops a read that answered for the tenant it left', async () => {
        const store = useMetadataStore();
        const answers = (payload, delay) =>
            new Promise((resolve) =>
                setTimeout(
                    () =>
                        resolve({
                            ok: true,
                            status: 200,
                            headers: { get: () => 'application/json' },
                            json: async () => payload,
                        }),
                    delay
                )
            );

        let read = 0;

        window.fetch = () =>
            read++ === 0 ? answers({ company: { label: 'left' } }, 5) : answers({ company: { label: 'joined' } }, 0);

        const reading = store.fetchMetadatas();

        bus.trigger(METADATA_INVALIDATED);
        await reading;

        expect(await store.getMetadata('company')).toEqual({ label: 'joined' });
    });
});

describe('the workspace store, saying what it knows', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        localStorage.setItem('access_token', tokenExpiringIn(600));
        localStorage.setItem('refresh_token', 'the-refresh-token');
    });

    it('hands the socket a scope that follows the tenant it holds', async () => {
        const store = useWorkspaceStore();
        const asked = { source: null };

        await bus.triggerAndWait(REALTIME_SOURCE_REQUEST, asked);
        store.current = { slug: 'studio-nord' };

        expect(toValue(asked.source)).toBe('studio-nord');
    });

    it('says the metadatas are stale when the tenant changes, and not when the first one opens', async () => {
        const store = useWorkspaceStore();
        const stale = vi.fn();

        bus.addEventListener(METADATA_INVALIDATED, stale);
        store.current = { slug: 'studio-nord' };
        await nextTick();

        expect(stale).not.toHaveBeenCalled();

        store.current = { slug: 'studio-sud' };
        await nextTick();
        bus.removeEventListener(METADATA_INVALIDATED, stale);

        expect(stale).toHaveBeenCalledTimes(1);
    });
});
