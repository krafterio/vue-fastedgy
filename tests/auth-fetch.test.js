/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import { fetch } from '../network/fetch.js';
import { useFetcher } from '../composables/fetcher.js';
import { absoluteUrl, setDefaultBaseUrl, useAuthFetch, useUrlContextFetch } from '../plugins/fetcher.js';

const jsonResponse = (payload) => ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => payload,
});

const tokenExpiringIn = (seconds) =>
    `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }))}.signature`;

const urlsOf = (spy) => spy.mock.calls.map(([url]) => url);

describe('useAuthFetch', () => {
    let fetchSpy;

    beforeEach(() => {
        setActivePinia(createPinia());
        localStorage.setItem('access_token', tokenExpiringIn(-60));
        localStorage.setItem('refresh_token', 'the-refresh-token');

        fetchSpy = vi.fn((url) =>
            Promise.resolve(
                url.includes('/auth/refresh')
                    ? jsonResponse({ access_token: tokenExpiringIn(600), refresh_token: 'the-refresh-token' })
                    : jsonResponse({ id: 7 })
            )
        );
        window.fetch = fetchSpy;
    });

    it('sends a request whose token had to be refreshed exactly once', async () => {
        useAuthFetch();

        const response = await fetch('/me');
        const urls = urlsOf(fetchSpy);

        expect(urls.filter((url) => url.endsWith('/me'))).toHaveLength(1);
        expect(urls.filter((url) => url.endsWith('/auth/refresh'))).toHaveLength(1);
        expect(response.data).toEqual({ id: 7 });
    });

    it('carries the refreshed token on that request', async () => {
        useAuthFetch();

        await fetch('/me');

        const call = fetchSpy.mock.calls.find(([url]) => url.endsWith('/me'));

        expect(call[1].headers['Authorization']).toBe(`Bearer ${localStorage.getItem('access_token')}`);
    });
});

describe('absoluteUrl', () => {
    beforeEach(() => {
        setDefaultBaseUrl('/api');
    });

    it('resolves a path against the base', () => {
        expect(absoluteUrl('/me')).toBe('/api/me');
        expect(absoluteUrl('me')).toBe('/api/me');
    });

    it('leaves a path already resolved where it is', () => {
        expect(absoluteUrl('/api/me')).toBe('/api/me');
        expect(absoluteUrl('/api')).toBe('/api');
    });

    it('resolves a path that merely starts like the base', () => {
        expect(absoluteUrl('/apidoc')).toBe('/api/apidoc');
    });

    it('leaves an absolute url alone', () => {
        expect(absoluteUrl('https://krafter.io/me')).toBe('https://krafter.io/me');
        expect(absoluteUrl('//krafter.io/me')).toBe('//krafter.io/me');
    });
});

describe('useUrlContextFetch', () => {
    const jsonOk = () => ({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({}),
    });

    // The listener lives on the bus of the module: a test that leaves it there
    // answers for the next one.
    const asking = async (options, url) => {
        const fetchSpy = vi.fn(() => Promise.resolve(jsonOk()));
        const stop = useUrlContextFetch(options);

        window.fetch = fetchSpy;

        try {
            await fetch(url);
        } finally {
            stop();
        }

        return fetchSpy.mock.calls[0][0];
    };

    it('fills the surface an application names', async () => {
        expect(await asking({ surface: 'console' }, '/{app}/users')).toBe('/api/console/users');
    });

    it('erases the placeholder for a surface with no segment of its own', async () => {
        expect(await asking({ surface: '' }, '/{app}/users')).toBe('/api/users');
    });

    it('leaves the placeholder where it is when no surface is named', async () => {
        expect(await asking({}, '/{app}/users')).toBe('/api/{app}/users');
    });
});

describe('useFetcher, outside a component', () => {
    it('reads without asking Vue for a lifecycle it has no instance for', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        window.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ id: 1 }),
        });

        const fetcher = useFetcher();

        await fetcher.get('/companies/1');

        expect(warn).not.toHaveBeenCalled();

        warn.mockRestore();
    });

    it('reads from a render without asking Vue for a lifecycle', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        mount({
            render() {
                useFetcher();

                return h('div');
            },
        });

        expect(warn).not.toHaveBeenCalled();

        warn.mockRestore();
    });

    it('aborts what a component asked for when it unmounts', async () => {
        let signal = null;

        window.fetch = vi.fn((url, options) => {
            signal = options.signal;

            return new Promise(() => {});
        });

        const view = mount({
            setup() {
                void useFetcher().get('/companies/1');

                return () => h('div');
            },
        });

        await new Promise((resolve) => setTimeout(resolve, 0));
        view.unmount();

        expect(signal?.aborted).toBe(true);
    });
});
