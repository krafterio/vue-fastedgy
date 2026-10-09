/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { useFetcherService } from '../composables/fetcher.js';
import { setDefaultBaseUrl, useUrlContextFetch } from '../plugins/fetcher.js';
import { useMetadataStore } from '../stores/metadata.js';
import { useWorkspaceRouterGuard, useWorkspaceStore, useWorkspaces } from '../stores/workspace.js';

const tokenExpiringIn = (seconds) =>
    `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }))}.signature`;

const settle = async () => {
    for (let turn = 0; turn < 20; turn++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
};

const page = { render: () => null };

const workspace = (id, slug, isDefault = false) => ({ id, slug, name: slug, is_default: isDefault });

describe('useWorkspaceRouterGuard', () => {
    let routes;
    let sent;
    let stop;
    let router;

    beforeEach(() => {
        setActivePinia(createPinia());
        localStorage.clear();
        localStorage.setItem('access_token', tokenExpiringIn(600));
        localStorage.setItem('refresh_token', 'the-refresh-token');
        setDefaultBaseUrl('/api');
        sent = [];
        routes = {
            'GET /me': { status: 200, body: { id: 1 } },
            'GET /workspaces': { status: 200, body: { items: [workspace(1, 'alpha'), workspace(2, 'beta', true)] } },
            'GET /alpha/dataset/metadatas': { status: 200, body: {} },
            'GET /beta/dataset/metadatas': { status: 200, body: {} },
        };
        window.fetch = async (url, init = {}) => {
            const key = `${init.method ?? 'GET'} ${new URL(url, 'http://test').pathname.replace(/^\/api/, '')}`;
            const answer = routes[key] ?? { status: 404, body: { detail: 'Not Found' } };

            sent.push(key);

            return {
                ok: answer.status < 300,
                status: answer.status,
                statusText: String(answer.status),
                headers: { get: () => 'application/json' },
                json: async () => answer.body,
            };
        };
        const stops = [useUrlContextFetch(), useWorkspaces({ workspaceless: null })];

        stop = () => stops.forEach((each) => each());
        useMetadataStore().setPrefix('/{workspace}');
        router = createRouter({
            history: createMemoryHistory(),
            routes: [
                { path: '/', name: 'Root', component: page, meta: { workspace: true } },
                { path: '/w/:workspace/home', name: 'Home', component: page },
                { path: '/w/:workspace/notes', name: 'Notes', component: page },
                { path: '/workspaces/new', name: 'Create', component: page },
            ],
        });
        useWorkspaceRouterGuard(router, {
            home: (slug) => ({ name: 'Home', params: { workspace: slug } }),
            empty: { name: 'Create' },
        });
    });

    afterEach(() => {
        useWorkspaceStore().$dispose();
        useMetadataStore().$dispose();
        stop();
    });

    it('leads the root to the home of the workspace the choice opens', async () => {
        await router.push('/');

        expect(router.currentRoute.value.fullPath).toBe('/w/beta/home');
    });

    it('keeps a page under the slug its URL carries', async () => {
        await router.push('/w/alpha/notes');

        expect(router.currentRoute.value.fullPath).toBe('/w/alpha/notes');
        expect(useWorkspaceStore().slug).toBe('alpha');
    });

    it('leads a page under a slug the server refuses to the same page under the choice', async () => {
        await router.push('/w/gamma/notes');
        await settle();

        expect(router.currentRoute.value.fullPath).toBe('/w/beta/notes');
    });

    it('settles when the app navigates while the guard leads away from a workspace left', async () => {
        await router.push('/w/alpha/notes');
        await settle();

        // Counted rather than left to loop: a loop of replaced navigations never
        // yields, and would hang the suite instead of failing it.
        const replace = router.replace.bind(router);
        let replaced = 0;

        router.replace = (to) => {
            replaced += 1;

            if (replaced > 10) {
                throw new Error('The guard keeps rerouting');
            }

            return replace(to);
        };

        await useWorkspaceStore().leave(async () => {});
        await router.push('/');
        await settle();

        expect(replaced).toBeLessThanOrEqual(10);
        expect(router.currentRoute.value.fullPath).toBe('/w/beta/home');
    });

    it('sends an account without a workspace to the empty route', async () => {
        routes['GET /workspaces'] = { status: 200, body: { items: [] } };

        await router.push('/');

        expect(router.currentRoute.value.name).toBe('Create');
    });

    it('reads the list once for requests answering 404 together', async () => {
        await router.push('/w/alpha/notes');
        await settle();
        sent = [];

        const fetcher = useFetcherService();

        await Promise.allSettled([fetcher.get('/{workspace}/notes/1'), fetcher.get('/{workspace}/notes/2')]);
        await settle();

        expect(sent.filter((key) => key === 'GET /workspaces')).toHaveLength(1);
    });
});
