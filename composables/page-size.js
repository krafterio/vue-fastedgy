/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { ref, watch } from 'vue';

/**
 * Resolve the page size, in order: the url, what the holder remembered, the default.
 *
 * @param {number|string|null} queryParam - Size read from the url
 * @param {Array<number>} availableSizes - Sizes the holder offers
 * @param {number} defaultSize - Size to fall back on
 * @param {string|null} storageKey - Where the choice is remembered, nowhere when null
 * @returns {number}
 */
function resolvePageSize(queryParam, availableSizes, defaultSize, storageKey) {
    if (queryParam != null) {
        const size = parseInt(queryParam, 10);

        if (availableSizes.includes(size)) {
            return size;
        }
    }

    if (storageKey) {
        const stored = parseInt(localStorage.getItem(storageKey), 10);

        if (availableSizes.includes(stored)) {
            return stored;
        }
    }

    return availableSizes.includes(defaultSize) ? defaultSize : availableSizes[0];
}

/**
 * Page size of a list, remembered under `storageKey` when the holder asks for it.
 *
 * A holder that names no key reads and writes nothing: its size is the one it was
 * given, and another list's remembered choice does not decide for it.
 *
 * @param {number|string|null} queryParam - Size read from the url
 * @param {Array<number>} availableSizes - Sizes the holder offers
 * @param {number} defaultSize - Size to fall back on
 * @param {string|null} [storageKey] - Where the choice is remembered
 * @returns {import("vue").Ref<number>}
 */
export function usePageSize(queryParam, availableSizes, defaultSize, storageKey = null) {
    const pageSize = ref(resolvePageSize(queryParam, availableSizes, defaultSize, storageKey));

    if (storageKey) {
        watch(pageSize, (size) => localStorage.setItem(storageKey, String(size)));
    }

    return pageSize;
}
