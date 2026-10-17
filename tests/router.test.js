/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { cleanRedirect, redirectIfExist } from '../utils/router.js';

function routerAt(query) {
    return { currentRoute: ref({ path: '/login', query }), replace: vi.fn() };
}

describe('cleanRedirect', () => {
    it('removes the redirect of a location and keeps the rest', () => {
        expect(cleanRedirect('/w/acme/notes?list=3&redirect=%2Faccount#top')).toBe('/w/acme/notes?list=3#top');
    });

    it('keeps a location without redirect as it is', () => {
        expect(cleanRedirect('/w/acme/notes?list=3')).toBe('/w/acme/notes?list=3');
    });

    it('answers a path of the app', () => {
        expect(cleanRedirect('https://example.com/w/acme')).toBe('/w/acme');
        expect(cleanRedirect('//example.com/w/acme')).toBe('/w/acme');
    });
});

describe('redirectIfExist', () => {
    it('replaces the route with its redirect, decoded and cleaned', async () => {
        const router = routerAt({ redirect: encodeURIComponent('/w/acme/notes?list=3&redirect=/account') });

        expect(await redirectIfExist(router)).toBe(true);
        expect(router.replace).toHaveBeenCalledWith('/w/acme/notes?list=3');
    });

    it('takes the first of several redirects', async () => {
        const router = routerAt({ redirect: ['%2Fw%2Facme', '%2Faccount'] });

        expect(await redirectIfExist(router)).toBe(true);
        expect(router.replace).toHaveBeenCalledWith('/w/acme');
    });

    it('stays without redirect', async () => {
        const router = routerAt({});

        expect(await redirectIfExist(router)).toBe(false);
        expect(router.replace).not.toHaveBeenCalled();
    });
});
