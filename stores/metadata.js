/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { defineStore } from 'pinia';
import { onScopeDispose, ref } from 'vue';
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

/**
 * @typedef {Object} MetadataField
 * @property {string} name
 * @property {string} label
 * @property {string} type
 * @property {boolean} readonly
 * @property {boolean} required
 * @property {boolean} searchable
 * @property {boolean} extra A field a workspace added to the model
 * @property {Array<string>} filter_operators
 * @property {string|null} [target]
 * @property {Array<string>|null} [targets]
 * @property {Record<string, string>|null} [choices]
 * @property {any} [default] The static value a new record starts with; null when
 *   the server computes it on save
 * @property {string|null} [local_placeholder]
 */

/**
 * @typedef {Object} MetadataModel
 * @property {string} name
 * @property {string} api_name
 * @property {string} label
 * @property {string} label_plural
 * @property {boolean} has_extra_fields
 * @property {Record<string, MetadataField>} fields
 */

/**
 * @typedef {Object} MetadataScope
 * @property {string} scope What the metadatas read are kept under
 * @property {string} prefix The prefix they are read under
 */

/** @type {((prefix: string) => MetadataScope|Promise<MetadataScope>)|null} */
let scopeResolver = null;

/**
 * Keep the metadatas by scope rather than as one set: [resolver] says, from
 * the prefix the application set, which scope it reads in and the prefix to
 * read it under. Coming back to a scope reads nothing. Whatever knows the
 * scope injects it (the workspaces do, see `createWorkspaces`); `null` goes
 * back to one set.
 *
 * @param {((prefix: string) => MetadataScope|Promise<MetadataScope>)|null} resolver
 */
export function setMetadataScope(resolver) {
    scopeResolver = resolver;
}

export const useMetadataStore = defineStore('metadata', () => {
    const loading = ref(false);
    const error = ref(null);
    const prefix = ref(null);
    const authStore = useAuthStore();
    const fetcher = useFetcher({ abortOnUnmounted: false });
    /** @type {Map<String, Object>} */
    const read = new Map();
    /** @type {Map<String, {asked: Number, pending: Promise<*>}>} */
    const reading = new Map();
    // The scope last read in, for what is set by hand.
    let lastScope = '';
    // Which reads are still wanted: one asked before an invalidation answers for
    // what nobody reads any more.
    let generation = 0;

    const forget = () => {
        generation += 1;
        read.clear();
        reading.clear();
    };

    bus.addEventListener(METADATA_INVALIDATED, forget);
    // What was read belongs to the account that signed out: the next one may
    // see other fields.
    bus.addEventListener('auth:logout', forget);
    onScopeDispose(() => {
        bus.removeEventListener(METADATA_INVALIDATED, forget);
        bus.removeEventListener('auth:logout', forget);
    });

    function setPrefix(newPrefix) {
        prefix.value = newPrefix;
    }

    function getPrefix() {
        return prefix.value;
    }

    /** @returns {Promise<MetadataScope>} */
    async function currentScope() {
        const base = prefix.value || '';
        const resolved = scopeResolver ? await scopeResolver(base) : null;

        lastScope = resolved?.scope ?? '';

        return resolved ?? { scope: '', prefix: base };
    }

    /**
     * Read the metadatas of [scope] under [scopePrefix], once for every caller
     * asking meanwhile.
     *
     * @param {String} scope
     * @param {String} scopePrefix
     * @param {{again?: Boolean, asked?: Number}} [options] `again` reads even
     *   what is held; `asked` is the generation the caller asked in
     * @returns {Promise<*>} What the read ran into, null when it went well
     */
    function readScope(scope, scopePrefix, { again = false, asked = generation } = {}) {
        if (!authStore.isAuthenticated || (!again && read.has(scope))) {
            return Promise.resolve(null);
        }

        const running = reading.get(scope);

        if (running?.asked === asked) {
            return running.pending;
        }

        const pending = (async () => {
            loading.value = true;
            error.value = null;

            try {
                const response = await fetcher.get(scopePrefix + '/dataset/metadatas');

                if (asked === generation) {
                    read.set(scope, response.data);
                }

                return null;
            } catch (err) {
                error.value = err;

                return err;
            } finally {
                loading.value = false;

                if (reading.get(scope)?.pending === pending) {
                    reading.delete(scope);
                }
            }
        })();

        reading.set(scope, { asked, pending });

        return pending;
    }

    async function fetchMetadatas() {
        const asked = generation;
        const current = await currentScope();

        return readScope(current.scope, current.prefix, { again: true, asked });
    }

    function setMetadatas(newMetadatas) {
        read.set(lastScope, newMetadatas);
    }

    async function getMetadatas() {
        const asked = generation;
        const current = await currentScope();

        await readScope(current.scope, current.prefix, { asked });

        return read.get(current.scope) ?? null;
    }

    /**
     * @param {string} modelName
     * @returns {Promise<MetadataModel|null>}
     */
    async function getMetadata(modelName) {
        const metadatas = await getMetadatas();

        return metadatas?.[modelName] || null;
    }

    return {
        loading,
        error,
        prefix,
        setPrefix,
        getPrefix,
        readScope,
        fetchMetadatas,
        setMetadatas,
        getMetadatas,
        getMetadata,
    };
});
