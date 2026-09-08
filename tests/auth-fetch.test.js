/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetch } from '../network/fetch.js';
import { absoluteUrl, setDefaultBaseUrl, useAuthFetch } from '../plugins/fetcher.js';

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
