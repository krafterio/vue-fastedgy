/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useAuthStore } from './auth.js';
import { bus } from '../composables/bus.js';
import { useFetcher } from '../composables/fetcher.js';

/**
 * Say that what this store holds is not what the application reads any more.
 *
 * What a metadata describes depends on who is reading it: a tenant adds its own
 * fields to a model, and the next one adds others. Whatever knows that changed
 * announces it here, and the store reads again when it is next asked, rather
 * than depending on something it knows nothing about.
 *
 * @type {String}
 *
 * @example
 * bus.trigger(METADATA_INVALIDATED);
 */
export const METADATA_INVALIDATED = 'metadata:invalidated';

export const useMetadataStore = defineStore('metadata', () => {
    const metadatas = ref(null);
    const loading = ref(false);
    const error = ref(null);
    const prefix = ref(null);
    const authStore = useAuthStore();
    const fetcher = useFetcher({ abortOnUnmounted: false });
    /** @type {Promise<void>|null} */
    let fetchPromise = null;
    // Which set of metadatas is the one being asked for: a read started before
    // an invalidation answers for what nobody reads any more.
    let generation = 0;

    bus.addEventListener(METADATA_INVALIDATED, () => {
        generation += 1;
        metadatas.value = null;
        fetchPromise = null;
    });

    function setPrefix(newPrefix) {
        prefix.value = newPrefix;
    }

    function getPrefix() {
        return prefix.value;
    }

    async function fetchMetadatas() {
        if (!authStore.isAuthenticated) {
            return;
        }

        const asked = generation;

        fetchPromise ??= (async () => {
            loading.value = true;
            error.value = null;

            try {
                const response = await fetcher.get((prefix.value || '') + '/dataset/metadatas');

                if (asked === generation) {
                    setMetadatas(response.data);
                }
            } catch (err) {
                error.value = err;
            } finally {
                loading.value = false;

                if (asked === generation) {
                    fetchPromise = null;
                }
            }
        })();

        await fetchPromise;
    }

    function setMetadatas(newMetadatas) {
        metadatas.value = newMetadatas;
    }

    async function getMetadatas() {
        if (!metadatas.value) {
            await fetchMetadatas();
        }

        return metadatas.value;
    }

    async function getMetadata(modelName) {
        const metadatas = await getMetadatas();

        return metadatas[modelName] || null;
    }

    return {
        loading,
        error,
        prefix,
        setPrefix,
        getPrefix,
        fetchMetadatas,
        setMetadatas,
        getMetadatas,
        getMetadata,
    };
});
