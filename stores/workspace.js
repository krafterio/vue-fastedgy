/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { bus } from '../composables/bus.js';
import { useFetcherService } from '../composables/fetcher.js';
import { REALTIME_SOURCE, REALTIME_SOURCE_REQUEST } from '../composables/realtime.js';
import { useAuthStore } from './auth.js';
import { METADATA_INVALIDATED } from './metadata.js';

const SELECTED_KEY = 'workspace.slug';

let selectedFields = 'id,name,slug';

/**
 * Name the columns the workspace list carries, for an application that shows
 * more than a name.
 */
export function setWorkspaceFields(fields) {
    selectedFields = fields;
}

/**
 * The workspace the user last chose, before anything is loaded.
 *
 * Read by a router that has to name one in a redirect target, which happens
 * before the store had a chance to answer.
 */
export function storedWorkspaceSlug() {
    return localStorage.getItem(SELECTED_KEY);
}

export const useWorkspaceStore = defineStore('workspace', () => {
    const authStore = useAuthStore();
    const workspaces = ref([]);
    const current = ref(null);
    const loading = ref(false);
    /** @type {Promise<void>|null} */
    let loadPromise = null;

    const slug = computed(() => current.value?.slug || null);

    // What the socket scopes itself to, said on the bus rather than read from
    // here: it holds a workspace without knowing what one is, and an
    // application that serves a single tenant has no store to be read.
    bus.trigger(REALTIME_SOURCE, { source: slug });

    // A socket that started before this store existed, and heard nothing.
    bus.addEventListener(REALTIME_SOURCE_REQUEST, (event) => {
        event.detail.source = slug;
    });

    // The slug rather than the record: a list read again is the same tenant,
    // and what a model declares is what this workspace added to it, which the
    // next one adds otherwise.
    watch(slug, () => bus.trigger(METADATA_INVALIDATED));

    function api() {
        return useFetcherService();
    }

    /**
     * The workspaces of the user, read once.
     *
     * Callers ask for it on every request that names one in its URL, so the
     * in-flight promise is shared rather than the list read again.
     */
    async function load() {
        if (!authStore.isAuthenticated || current.value) {
            return current.value;
        }

        loadPromise ??= (async () => {
            loading.value = true;

            try {
                workspaces.value = await list();

                const selected = storedWorkspaceSlug();

                current.value = workspaces.value.find((item) => item.slug === selected) ?? workspaces.value[0] ?? null;
            } finally {
                loading.value = false;
                loadPromise = null;
            }
        })();

        await loadPromise;

        return current.value;
    }

    async function list() {
        const response = await api().get('/workspaces', {
            params: { limit: 200 },
            headers: { 'X-Fields': selectedFields },
        });

        return response.data?.items ?? [];
    }

    async function refresh() {
        const items = await list();

        workspaces.value = items;
        current.value = items.find((item) => item.slug === current.value?.slug) ?? current.value;

        return current.value;
    }

    async function create(payload) {
        const response = await api().post('/workspaces', typeof payload === 'string' ? { name: payload } : payload);
        const workspace = response.data;

        workspaces.value = [...workspaces.value, workspace];
        select(workspace);

        return workspace;
    }

    async function remove(value) {
        await api().delete(`/${value}/workspace`);

        workspaces.value = workspaces.value.filter((item) => item.slug !== value);

        const next = workspaces.value[0] ?? null;

        if (next) {
            select(next);
        } else {
            current.value = null;
            localStorage.removeItem(SELECTED_KEY);
        }

        return next;
    }

    function select(value) {
        const found = typeof value === 'string' ? workspaces.value.find((item) => item.slug === value) : value;

        if (!found) {
            return;
        }

        current.value = found;
        localStorage.setItem(SELECTED_KEY, found.slug);
    }

    return {
        workspaces,
        current,
        slug,
        loading,
        load,
        refresh,
        create,
        remove,
        select,
    };
});
