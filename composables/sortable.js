/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { ref, computed } from 'vue';
import { useDataset } from './dataset.js';

/**
 * Composable for drag & drop resequencing functionality
 *
 * @param {string} modelName - API model name
 * @param {object|Promise<object>} metadata - Model metadata from metadata store, which hands it back as a promise
 * @param {boolean|undefined} sortableConfig - Sortable configuration override
 * @param {{prefix?: string}} [options] - Where the dataset routes answer, when they are not at the root
 * @returns {Object} Sortable state and methods, `ready` settling once the metadata is read
 */
export function useSortable(modelName, metadata, sortableConfig, options = {}) {
    const { resequence: sendOrder } = useDataset({ prefix: options.prefix });

    const isSortable = ref(false);
    const sortableField = ref(null);

    const applyMetadata = (model) => {
        if (sortableConfig === undefined) {
            if (model?.sortable) {
                isSortable.value = true;
                sortableField.value = model.sortable_field || 'sequence';
            }
        } else if (sortableConfig === true) {
            isSortable.value = true;
            sortableField.value = model?.sortable_field || 'sequence';
        }
    };

    const ready = Promise.resolve(metadata).then(applyMetadata, () => applyMetadata(null));

    /**
     * Resequence items by updating their sequence field
     * @param {Array<number>} ids - New order of item IDs
     * @returns {Promise<void>}
     */
    const resequence = async (ids) => {
        if (!isSortable.value || !sortableField.value) {
            console.warn('[useSortable] Resequencing is not enabled');
            return;
        }

        await sendOrder(modelName, ids, { sequenceField: sortableField.value });
    };

    /**
     * Get the sortable field name (if sortable)
     * @returns {string|null}
     */
    const getSortableField = () => sortableField.value;

    return {
        isSortable,
        sortableField: computed(() => sortableField.value),
        resequence,
        getSortableField,
        ready,
    };
}
