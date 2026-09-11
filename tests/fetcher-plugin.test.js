/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from 'vue';
import { fetch } from '../network/fetch.js';
import { createFetcher } from '../plugins/fetcher.js';
import { ORIGIN_HEADER } from '../utils/origin.js';

const sentHeaders = (spy) => spy.mock.calls.at(-1)[1].headers ?? {};

describe('createFetcher', () => {
    let fetchSpy;

    beforeEach(() => {
        setActivePinia(createPinia());
        fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 204, headers: { get: () => null } });
        window.fetch = fetchSpy;
    });

    it('listens to the requests of an application while it lives, and no longer', async () => {
        const app = createApp({ render: () => null }).use(createFetcher());

        app.mount(document.createElement('div'));
        await fetch('/notes');

        expect(sentHeaders(fetchSpy)[ORIGIN_HEADER]).toBeDefined();

        app.unmount();
        await fetch('/notes');

        expect(sentHeaders(fetchSpy)[ORIGIN_HEADER]).toBeUndefined();
    });
});
