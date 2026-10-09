/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import corpus from './fixtures/workspaces.json';
import { bus } from '../composables/bus.js';
import { useFetcherService } from '../composables/fetcher.js';
import { RESOURCES_STALE } from '../composables/realtime.js';
import { RESOURCE_CHANGED } from '../network/realtime.js';
import { setDefaultBaseUrl, useUrlContextFetch } from '../plugins/fetcher.js';
import { useAuthStore } from '../stores/auth.js';
import { useMetadataStore } from '../stores/metadata.js';
import { WORKSPACE_LOST, useWorkspaceStore, useWorkspaces } from '../stores/workspace.js';

const tokenExpiringIn = (seconds) =>
    `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }))}.signature`;

const settle = async () => {
    for (let turn = 0; turn < 20; turn++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
};

const byName = (one, other) => one.localeCompare(other);

const keyOf = (method, url) => `${method.toUpperCase()} ${new URL(url, 'http://test').pathname.replace(/^\/api/, '')}`;

/**
 * The server a case describes: the answers of the corpus, those of the case,
 * and the list of the account, each step able to change what follows.
 */
function serverOf(testCase) {
    const routes = { ...corpus.server, ...testCase.server };
    const listOf = (names) => ({
        status: 200,
        body: { items: names.map((name) => corpus.workspaces[name]), total: names.length },
    });

    if (testCase.list) {
        routes['GET /workspaces'] = listOf(testCase.list);
    }

    return {
        routes,
        update(step) {
            Object.assign(routes, step.server ?? {});

            if (step.list) {
                routes['GET /workspaces'] = listOf(step.list);
            }
        },
    };
}

const failing = { workspaceless: undefined };

describe('the workspace corpus shared with flutter_fastedgy', () => {
    let stops;
    let sent;
    let events;

    beforeEach(() => {
        setActivePinia(createPinia());
        localStorage.clear();
        setDefaultBaseUrl('/api');
        stops = [];
        sent = [];
        events = [];
    });

    afterEach(() => {
        useWorkspaceStore().$dispose();
        useMetadataStore().$dispose();
        stops.forEach((stop) => stop());
    });

    it.each(corpus.cases)('$name', async (testCase) => {
        const options = { ...failing, ...testCase.options };
        const server = serverOf(testCase);

        localStorage.setItem('access_token', tokenExpiringIn(600));
        localStorage.setItem('refresh_token', 'the-refresh-token');

        if (testCase.device) {
            localStorage.setItem('workspace.slug', testCase.device);
        }

        window.fetch = async (url, init = {}) => {
            const key = keyOf(init.method ?? 'GET', url);
            const answer = server.routes[key] ?? { status: 404, body: { detail: 'Not Found' } };

            sent.push(key);

            return {
                ok: answer.status >= 200 && answer.status < 300,
                status: answer.status,
                statusText: String(answer.status),
                headers: { get: () => 'application/json' },
                json: async () => answer.body,
            };
        };

        stops.push(useUrlContextFetch());
        stops.push(
            useWorkspaces({ rememberLast: options.rememberLast ?? true, workspaceless: options.workspaceless ?? null })
        );

        const authStore = useAuthStore();
        const store = useWorkspaceStore();
        const fetcher = useFetcherService();

        useMetadataStore().setPrefix('/{workspace}');

        const stale = () => events.push('stale');
        const lost = (event) => events.push(`lost:${event.detail.name}`);

        bus.addEventListener(RESOURCES_STALE, stale);
        bus.addEventListener(WORKSPACE_LOST, lost);
        stops.push(() => {
            bus.removeEventListener(RESOURCES_STALE, stale);
            bus.removeEventListener(WORKSPACE_LOST, lost);
        });

        for (const step of testCase.steps) {
            server.update(step);
            sent = [];
            events = [];

            let decision;
            let failed = false;

            if ('open' in step) {
                decision = await store.resolve(step.open);
            } else if ('select' in step) {
                store.select(step.select);
            } else if ('makeDefault' in step) {
                await store.makeDefault(step.makeDefault);
            } else if (step.logout) {
                await authStore.logout();
                authStore.setTokens(tokenExpiringIn(600), 'the-next-refresh-token');
            } else if ('request' in step) {
                const [method, path] = step.request.split(' ');

                try {
                    await fetcher[method.toLowerCase()](path);
                } catch {
                    failed = true;
                }
            } else if ('change' in step) {
                bus.trigger(RESOURCE_CHANGED, {
                    model: step.change,
                    id: null,
                    action: 'updated',
                    changed: null,
                    origin: null,
                    truncated: true,
                    data: null,
                });
            } else if ('leave' in step) {
                const [method, path] = step.leave.split(' ');

                await store.leave(() => fetcher[method.toLowerCase()](path));
            }

            await settle();

            const expected = step.expect ?? {};
            const at = JSON.stringify(step);

            if ('decision' in expected) {
                expect(decision, at).toEqual(expected.decision);
            }

            if ('slug' in expected) {
                expect(store.slug, at).toBe(expected.slug);
            }

            if ('requests' in expected) {
                expect([...sent].sort(byName), at).toEqual([...expected.requests].sort(byName));
            }

            for (const [before, after] of expected.order ?? []) {
                expect(sent.indexOf(before), `${at}: ${before} before ${after}`).toBeLessThan(sent.indexOf(after));
            }

            if ('device' in expected) {
                expect(localStorage.getItem('workspace.slug'), at).toBe(expected.device);
            }

            if ('events' in expected) {
                expect(events, at).toEqual(expected.events);
            }

            if ('sent' in expected) {
                expect(sent, at).toContain(expected.sent);
            }

            if ('failed' in expected) {
                expect(failed, at).toBe(expected.failed);
            }

            if ('default' in expected) {
                expect(store.workspaces.find((item) => item.is_default)?.slug ?? null, at).toBe(expected.default);
            }
        }
    });
});
