/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { defineStore } from "pinia";
import { ref } from "vue";
import { useAuthStore } from "./auth.js";
import { useFetcher } from "../composables/fetcher.js";

export const useMetadataStore = defineStore("metadata", () => {
    const metadatas = ref(null);
    const loading = ref(false);
    const error = ref(null);
    const prefix = ref(null);
    const authStore = useAuthStore();
    const fetcher = useFetcher({ abortOnUnmounted: false });

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

        loading.value = true;
        error.value = null;

        try {
            const response = await fetcher.get((prefix.value || "") + "/dataset/metadatas");
            setMetadatas(response.data);
        } catch (err) {
            error.value = err;
        } finally {
            loading.value = false;
        }
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
        getMetadatas,
        getMetadata,
    };
});
