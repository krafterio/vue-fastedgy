/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { computed, onScopeDispose, ref } from 'vue';
import { defineStore } from 'pinia';
import { bus } from '../composables/bus.js';
import { useFetcherService } from '../composables/fetcher.js';
import { REALTIME_SOURCE, REALTIME_SOURCE_REQUEST, RESOURCES_STALE } from '../composables/realtime.js';
import { fetchBus } from '../network/fetch.js';
import { RESOURCE_CHANGED, realtime } from '../network/realtime.js';
import { useAuthStore } from './auth.js';
import { METADATA_INVALIDATED, setMetadataScope, useMetadataStore } from './metadata.js';

const REMEMBERED_KEY = 'workspace.slug';

const PLACEHOLDER = '/{workspace}';

/**
 * The current workspace left the list read again: the account was removed from
 * it, or it was deleted. Triggered with that workspace. The one the account
 * leaves itself ([leave]) is not announced.
 *
 * @type {String}
 */
export const WORKSPACE_LOST = 'workspace:lost';

/**
 * Whatever reads the current workspace off the URL has to read it again: the
 * one it names was refused by the server, lost or renamed.
 * [useWorkspaceRouterGuard] hears it.
 *
 * @type {String}
 */
export const WORKSPACE_REROUTE = 'workspace:reroute';

const MEMBERSHIP_MODELS = ['workspace', 'workspace_user'];

const defaults = {
    enabled: false,
    rememberLast: true,
    workspaceless: 'global',
    fields: 'id,name,slug',
};

const settings = { ...defaults };

/**
 * Name the columns the workspace list carries, for an application that shows
 * more than a name.
 */
export function setWorkspaceFields(fields) {
    settings.fields = fields;
}

/**
 * The workspace last opened on this device, before anything is loaded; null
 * when the application keeps no such memory.
 *
 * Read by a router that has to name one in a redirect target, which happens
 * before the store had a chance to answer.
 */
export function storedWorkspaceSlug() {
    if (!settings.rememberLast) {
        return null;
    }

    try {
        return localStorage.getItem(REMEMBERED_KEY);
    } catch {
        return null;
    }
}

function remember(slug) {
    if (!settings.rememberLast) {
        return;
    }

    try {
        if (slug) {
            localStorage.setItem(REMEMBERED_KEY, slug);
        } else {
            localStorage.removeItem(REMEMBERED_KEY);
        }
    } catch {
        // A browser refusing the storage only forgets the choice.
    }
}

/**
 * The account's workspaces and the current one, the tenant `/{workspace}`
 * stands for: chosen, followed and changed the way flutter_fastedgy's
 * `WorkspaceProvider` does, case for case (the corpus `workspaces.json` both
 * packages run).
 *
 * The choice, always after the account (`/me`): the slug of the URL as it is;
 * without one, or once the server refused it, the last workspace opened on
 * this device, then the account's default, then the first of the list.
 */
export const useWorkspaceStore = defineStore('workspace', () => {
    const authStore = useAuthStore();
    const workspaces = ref([]);
    const slug = ref(null);
    const currentId = ref(null);
    const loading = ref(false);
    const loaded = ref(false);
    const error = ref(null);
    /** The slugs this session cannot open: refused by the server, lost or left. */
    const refused = new Set();
    /** The id of a workspace renamed meanwhile, by a slug it had. */
    const renamed = new Map();
    /** @type {Promise<*>|null} */
    let loadPromise = null;
    /** @type {Promise<*>|null} */
    let refreshPromise = null;
    let refreshAgain = false;
    // Bumped by a sign-out: a read for the account that left answers for nobody.
    let generation = 0;
    // Each list read and each local change takes a number: a read answering after
    // a more recent one, or after a local change, tells an older list.
    let sequence = 0;
    let applied = 0;
    // A workspace was opened this session: a list read then chooses none itself.
    let opened = false;
    // The workspace being left: its disappearance is not a loss.
    let leaving = null;

    const byId = (id) => (id == null ? null : (workspaces.value.find((item) => item.id === id) ?? null));
    const bySlug = (value) => (value == null ? null : (workspaces.value.find((item) => item.slug === value) ?? null));

    const current = computed({
        get: () => byId(currentId.value) ?? bySlug(slug.value),
        set: (value) => select(value),
    });

    /** @type {Array<[String, function(CustomEvent): void]>} */
    const listening = [];
    const listen = (name, handler) => {
        bus.addEventListener(name, handler);
        listening.push([name, handler]);
    };

    // What the socket scopes itself to, said on the bus rather than read from
    // here: it holds a workspace without knowing what one is, and an
    // application that serves a single tenant has no store to be read.
    bus.trigger(REALTIME_SOURCE, { source: slug });

    // A socket that started before this store existed, and heard nothing.
    listen(REALTIME_SOURCE_REQUEST, (event) => {
        event.detail.source = slug;
    });

    // What the store holds belongs to the account that signed out: the next
    // one reads its own list, rather than opening the workspace of the last.
    listen('auth:logout', () => {
        generation += 1;
        applied = ++sequence;
        workspaces.value = [];
        slug.value = null;
        currentId.value = null;
        loading.value = false;
        loaded.value = false;
        error.value = null;
        loadPromise = null;
        refreshPromise = null;
        refused.clear();
        renamed.clear();
        opened = false;
    });

    for (const model of MEMBERSHIP_MODELS) {
        realtime.subscribe(model, null);
    }

    // A workspace or its members changed: the list says what the account has now.
    listen(RESOURCE_CHANGED, (event) => {
        if (loaded.value && MEMBERSHIP_MODELS.includes(event.detail?.model)) {
            void refresh();
        }
    });

    onScopeDispose(() => {
        listening.forEach(([name, handler]) => bus.removeEventListener(name, handler));

        for (const model of MEMBERSHIP_MODELS) {
            realtime.unsubscribe(model, null);
        }
    });

    function api() {
        return useFetcherService();
    }

    async function readAccount() {
        try {
            await authStore.checkUser();
        } catch {
            // The list read runs into the same, and says so.
        }
    }

    async function list() {
        const response = await api().get('/workspaces', {
            params: { limit: 200 },
            headers: { 'X-Fields': settings.fields },
        });

        return response.data?.items ?? [];
    }

    async function read() {
        const asked = ++sequence;
        const items = await list();

        if (asked < applied) {
            return;
        }

        applied = asked;
        apply(items);
    }

    function apply(items) {
        for (const item of items) {
            const before = byId(item.id);

            if (before && before.slug !== item.slug) {
                renamed.set(before.slug, item.id);
            }
        }

        const previous = current.value;

        workspaces.value = items;
        loaded.value = true;
        error.value = null;

        const held = byId(currentId.value) ?? bySlug(slug.value);

        currentId.value = held?.id ?? null;

        if (held && held.slug !== slug.value) {
            follow(held.slug);
        } else if (previous && !held && previous.id !== leaving) {
            bus.trigger(WORKSPACE_LOST, previous);
            refuse(previous.slug);
        }
    }

    /**
     * Make [workspace] (a slug, or a record of the list) the current one,
     * remember it on this device and read its metadatas. Every screen reads
     * again when another one was current.
     */
    function open(workspace) {
        const value = typeof workspace === 'string' ? workspace : workspace?.slug;

        if (!value || value === slug.value) {
            return;
        }

        const previous = slug.value;

        slug.value = value;
        currentId.value = (typeof workspace === 'string' ? bySlug(value) : workspace)?.id ?? null;
        opened = true;
        remember(value);
        void probe(value);

        if (previous) {
            // Without the metadatas held by workspace ([useWorkspaces]), those
            // read belong to the workspace left behind.
            if (!settings.enabled) {
                bus.trigger(METADATA_INVALIDATED);
            }

            bus.trigger(RESOURCES_STALE);
        }
    }

    /** The current workspace renamed: the same one, under its new slug. */
    function follow(value) {
        slug.value = value;
        remember(value);
        void probe(value);
        bus.trigger(WORKSPACE_REROUTE);
    }

    /**
     * Read the metadatas of [value], the first request under its slug: the
     * server refusing it (404) is the account not being a member.
     */
    async function probe(value) {
        const metadataStore = useMetadataStore();
        const base = metadataStore.getPrefix() || '';

        if (!settings.enabled || !base.includes(PLACEHOLDER)) {
            return;
        }

        const failure = await metadataStore.readScope(value, base.replace(PLACEHOLDER, `/${value}`));

        if (failure?.response?.status === 404 && slug.value === value) {
            refuse(value);
        }
    }

    /**
     * This session cannot open [value] any more: forgotten by the device, and
     * the choice opens another one in its place when it was current.
     */
    function refuse(value) {
        refused.add(value);

        if (storedWorkspaceSlug() === value) {
            remember(null);
        }

        if (slug.value === value) {
            const pick = loaded.value ? choose() : null;

            if (pick) {
                open(pick);
            } else {
                slug.value = null;
                currentId.value = null;

                if (!loaded.value) {
                    void load().then(() => {
                        if (!slug.value) {
                            open(choose());
                        }
                    });
                }
            }
        }

        bus.trigger(WORKSPACE_REROUTE);
    }

    /**
     * The workspace to open when nothing names one: the last one of this device,
     * then the account's default, then the first; never one this session
     * cannot open.
     */
    function choose() {
        const open = workspaces.value.filter((item) => !refused.has(item.slug));
        const last = storedWorkspaceSlug();

        return (
            (last ? open.find((item) => item.slug === last) : null) ??
            open.find((item) => item.is_default) ??
            open[0] ??
            null
        );
    }

    /**
     * The workspaces of the account, read once, after the account itself.
     *
     * A failure stays the answer until [retry]: a router asks on each of its
     * passes, and reading again there would turn a server that does not answer
     * into a loop of requests. Nothing opened yet, the read opens the choice.
     */
    function load() {
        if (!authStore.isAuthenticated) {
            return Promise.resolve(null);
        }

        if (loaded.value) {
            return Promise.resolve(current.value);
        }

        loadPromise ??= (async (asked) => {
            loading.value = true;

            try {
                await readAccount();
                await read();

                if (asked === generation && !opened && !slug.value) {
                    open(choose());
                }
            } catch (err) {
                if (asked === generation) {
                    error.value = err;
                    loaded.value = true;
                }
            } finally {
                if (asked === generation) {
                    loading.value = false;
                    loadPromise = null;
                }
            }

            return current.value;
        })(generation);

        return loadPromise;
    }

    /** Lets a failed read try again. */
    function retry() {
        loaded.value = false;
        error.value = null;
        loadPromise = null;

        return load();
    }

    /**
     * The list read again, and what comes with it. Called during such a read,
     * it runs another one after: what changed meanwhile may be missing from the
     * answer in progress. A failure keeps the list held.
     */
    function refresh() {
        if (refreshPromise) {
            refreshAgain = true;

            return refreshPromise;
        }

        refreshPromise = (async () => {
            try {
                do {
                    refreshAgain = false;

                    try {
                        await read();
                    } catch (err) {
                        console.warn('Workspaces refresh failed:', err);
                    }
                } while (refreshAgain);
            } finally {
                refreshPromise = null;
            }

            return current.value;
        })();

        return refreshPromise;
    }

    /**
     * For the fetcher: joins a read in progress rather than asking for another,
     * otherwise a read of that one failing the same way would ask again,
     * endlessly.
     */
    function refreshAfterError() {
        return refreshPromise ?? refresh();
    }

    /**
     * The current workspace, chosen when there is none yet: what a request under
     * `/{workspace}` waits for.
     *
     * @returns {Promise<String|null>} Its slug
     */
    async function ensureCurrent() {
        if (slug.value) {
            return slug.value;
        }

        await load();

        if (!slug.value) {
            open(choose());
        }

        return slug.value;
    }

    /**
     * What the URL should say, given the slug it carries.
     *
     * @param {String|null} [value] The slug of the URL
     * @returns {Promise<'stay'|'empty'|'failed'|{redirect: String}>} `stay`
     *   when the URL is right, `redirect` to the slug it should carry, `empty`
     *   for an account without a workspace, `failed` when its list cannot be read
     */
    async function resolve(value = null) {
        await readAccount();

        const moved = value ? renamedSlug(value) : null;

        if (moved) {
            open(moved);

            return { redirect: moved };
        }

        if (value && !refused.has(value)) {
            open(value);
            void load();

            return 'stay';
        }

        await load();

        if (error.value) {
            return 'failed';
        }

        const pick = choose();

        if (!pick) {
            return 'empty';
        }

        open(pick);

        return { redirect: pick.slug };
    }

    /**
     * Make a workspace of the list current, a record or its slug; nothing for one
     * the list does not have. The URL follows it, through whoever navigates.
     */
    function select(value) {
        const found = typeof value === 'string' ? bySlug(value) : value;

        if (found) {
            open(found);
        }
    }

    /**
     * Make the workspace of [value] current if the account has it.
     *
     * @returns {Promise<Boolean>}
     */
    async function selectSlug(value) {
        await load();

        const found = bySlug(value);

        if (found) {
            open(found);
        }

        return found !== null;
    }

    /**
     * Add a workspace just created or joined, before the list read again says so.
     * It only becomes current when none is: otherwise the URL picks it.
     */
    function adopt(workspace) {
        applied = ++sequence;
        workspaces.value = [...workspaces.value.filter((item) => item.id !== workspace.id), workspace];
        loaded.value = true;
        error.value = null;
        refused.delete(workspace.slug);

        if (!slug.value) {
            open(workspace);
        }

        void refresh();
    }

    async function create(payload) {
        const response = await api().post('/workspaces', typeof payload === 'string' ? { name: payload } : payload);
        const workspace = response.data;

        applied = ++sequence;
        workspaces.value = [...workspaces.value.filter((item) => item.id !== workspace.id), workspace];
        refused.delete(workspace.slug);
        open(workspace);

        return workspace;
    }

    /** Drop a workspace the account no longer has; the choice follows when it was current. */
    function drop(value) {
        applied = ++sequence;
        workspaces.value = workspaces.value.filter((item) => item.slug !== value);
        refuse(value);
    }

    /**
     * Delete a workspace; the choice follows when it was current.
     *
     * @returns {Promise<Record<string, any>|null>} The current workspace after it
     */
    async function remove(value) {
        await api().delete(`/${value}/workspace`);
        drop(value);

        return current.value;
    }

    /**
     * Leave the current workspace through [request] (the application's route);
     * the choice follows. Noted before the request: a read answering meanwhile
     * does not announce it lost.
     *
     * @param {function(): Promise<*>} request
     * @returns {Promise<Record<string, any>|null>} The current workspace after it
     */
    async function leave(request) {
        const workspace = current.value;

        if (!workspace) {
            return null;
        }

        leaving = workspace.id;

        try {
            await request();
            drop(workspace.slug);
        } finally {
            leaving = null;
        }

        return current.value;
    }

    /** Make [value] the account's default workspace, on the server: never a side effect of a choice. */
    async function makeDefault(value) {
        await api().put(`/workspaces/${value}/default`);
        workspaces.value = workspaces.value.map((item) => ({ ...item, is_default: item.slug === value }));
    }

    /**
     * The present slug of the workspace that was called [value], if it was renamed.
     *
     * @returns {String|null}
     */
    function renamedSlug(value) {
        const id = renamed.get(value);
        const workspace = id == null ? null : byId(id);

        return workspace && workspace.slug !== value ? workspace.slug : null;
    }

    /**
     * Whether this session cannot open [value]: the server refused it, or the
     * account lost or left it.
     *
     * @returns {Boolean}
     */
    function isRefused(value) {
        return refused.has(value);
    }

    /**
     * Whether a resource change concerns the current workspace: its `workspace`
     * names it, or names none.
     */
    function concernsCurrent(change) {
        const workspace = change?.data?.workspace;

        return workspace == null || workspace === currentId.value;
    }

    return {
        workspaces,
        current,
        slug,
        loading,
        loaded,
        error,
        load,
        retry,
        refresh,
        refreshAfterError,
        ensureCurrent,
        resolve,
        select,
        selectSlug,
        adopt,
        create,
        remove,
        leave,
        makeDefault,
        renamedSlug,
        isRefused,
        bySlug,
        byId,
        concernsCurrent,
    };
});

/**
 * Wait for a session that is still being restored: a request fired while the
 * token is being refreshed would otherwise choose a workspace for an anonymous
 * user.
 */
async function untilAuthSettled(authStore) {
    if (!authStore.loading) {
        return;
    }

    await new Promise((resolve) => {
        const unwatch = authStore.$subscribe((mutation, state) => {
            if (!state.loading) {
                unwatch();
                resolve();
            }
        });
    });
}

/**
 * The metadatas of the current workspace, under its slug: what a model declares
 * is what that workspace added to it, and coming back to one reads nothing.
 *
 * @param {String} prefix
 * @returns {Promise<{scope: String, prefix: String}>}
 */
async function workspaceMetadataScope(prefix) {
    if (!prefix.includes(PLACEHOLDER)) {
        return { scope: '', prefix };
    }

    const slug = await useWorkspaceStore().ensureCurrent();

    return slug ? { scope: slug, prefix: prefix.replace(PLACEHOLDER, `/${slug}`) } : { scope: '', prefix };
}

/**
 * Serve one workspace at a time: the workspaces augment the fetcher and the
 * metadatas, which know nothing of them.
 *
 * - A request under `/{workspace}/` waits for the choice of the current
 *   workspace and goes under its slug; without one, under `workspaceless`
 *   (`global`), or it is refused when that is `null`. One answering 404 has the
 *   list read again: the workspace may be gone.
 * - The metadatas are held by workspace ([setMetadataScope]).
 *
 *
 * @param {{rememberLast?: Boolean, workspaceless?: String|null, fields?: String}} [options]
 *   `rememberLast`: the last workspace opened on this device is the one opened
 *   next (`true`); `fields`: the columns the list carries
 * @returns {function(): void} Stop serving them
 */
export function useWorkspaces(options = {}) {
    Object.assign(settings, defaults, options, { enabled: true });
    setMetadataScope(workspaceMetadataScope);

    // The requests sent under the current workspace, by their options: their
    // errors say something about it.
    const tenant = new WeakMap();

    const request = async (e) => {
        if (typeof e.detail.url !== 'string' || !e.detail.url.includes(`${PLACEHOLDER}/`)) {
            return;
        }

        await untilAuthSettled(useAuthStore());

        const slug = await useWorkspaceStore().ensureCurrent();
        const target = slug ?? settings.workspaceless;

        // A path that keeps the placeholder would reach a route that does not
        // exist, and its 404 would hide the real fault: no workspace to read.
        if (!target) {
            throw new Error(`No workspace to send ${e.detail.url} under`);
        }

        e.detail.url = e.detail.url.replace(`${PLACEHOLDER}/`, `/${target}/`);

        if (slug) {
            tenant.set(e.detail.options, slug);
        }
    };

    const failed = (e) => {
        if (tenant.has(e.detail.options) && e.detail.error?.response?.status === 404) {
            void useWorkspaceStore().refreshAfterError();
        }
    };

    fetchBus.addEventListener('fetch:request', request);
    fetchBus.addEventListener('fetch:error', failed);

    return () => {
        fetchBus.removeEventListener('fetch:request', request);
        fetchBus.removeEventListener('fetch:error', failed);
        setMetadataScope(null);
        Object.assign(settings, defaults);
    };
}

/**
 * [useWorkspaces] as a plugin.
 *
 * @param {{rememberLast?: Boolean, workspaceless?: String|null, fields?: String}} [options]
 *
 * @example
 * app.use(createFetcher({ surface: 'app' }));
 * app.use(createWorkspaces({ workspaceless: null }));
 */
export function createWorkspaces(options = {}) {
    return {
        install(app) {
            app.onUnmount(useWorkspaces(options));
        },
    };
}

/**
 * Keep the URL and the current workspace in step: a route carrying the
 * workspace (`:workspace`) is resolved on each navigation, and so is a route
 * asking for the choice (`meta.workspace: true`, the root). The decision is the
 * store's ([useWorkspaceStore.resolve]), the same as flutter_fastedgy's.
 *
 * A workspace refused, lost or renamed while its URL is shown leads the router
 * to resolve the current route again.
 *
 * @param {import('vue-router').Router} router
 * @param {{param?: String,
 *          home: function(String): import('vue-router').RouteLocationRaw,
 *          empty?: import('vue-router').RouteLocationRaw,
 *          failed?: import('vue-router').RouteLocationRaw}} options
 *   `home` is where a slug leads from a route that carries none; `empty` where
 *   an account without a workspace goes (`/` by default); `failed` where it goes
 *   when its list cannot be read (`empty` by default)
 */
export function useWorkspaceRouterGuard(router, { param = 'workspace', home, empty = '/', failed = empty } = {}) {
    router.beforeEach(async (to) => {
        const named = to.params?.[param];

        if ((named === undefined && to.meta?.workspace !== true) || !useAuthStore().isAuthenticated) {
            return true;
        }

        const decision = await useWorkspaceStore().resolve(named ?? null);

        if (decision === 'stay') {
            return true;
        }

        if (decision === 'empty') {
            return empty;
        }

        if (decision === 'failed') {
            return failed;
        }

        if (named !== undefined && to.name) {
            return {
                name: to.name,
                params: { ...to.params, [param]: decision.redirect },
                query: to.query,
                hash: to.hash,
            };
        }

        return home(decision.redirect);
    });

    // The URL names a workspace that cannot be opened, or that was renamed: the
    // guard reads it again. After each navigation as well, the refusal having
    // possibly come while it was under way.
    const reroute = () => {
        const route = router.currentRoute.value;
        const named = route.params?.[param];
        const store = useWorkspaceStore();

        if (named !== undefined && (store.isRefused(named) || store.renamedSlug(named))) {
            void router.replace({ path: route.path, query: route.query, hash: route.hash, force: true });
        }
    };

    bus.addEventListener(WORKSPACE_REROUTE, reroute);
    router.afterEach(() => reroute());
}
