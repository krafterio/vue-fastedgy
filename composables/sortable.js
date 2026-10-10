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
 * @returns {Object} Sortable state and methods, `ready` settling once the metadata is read, `readMetadata` reading
 *   it again
 */
export function useSortable(modelName, metadata, sortableConfig, options = {}) {
    const { resequence: sendOrder } = useDataset({ prefix: options.prefix });

    const isSortable = ref(false);
    const sortableField = ref(null);

    const applyMetadata = (model) => {
        isSortable.value = false;
        sortableField.value = null;

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

    /**
     * Read the sortable state again from metadata, another workspace's for instance
     * @param {object|Promise<object>} next - Model metadata, or the promise of it
     * @returns {Promise<void>}
     */
    const readMetadata = (next) => Promise.resolve(next).then(applyMetadata, () => applyMetadata(null));

    const ready = readMetadata(metadata);

    /**
     * Resequence items by updating their sequence field
     * @param {Array<number>} ids - New order of item IDs
     * @param {{ sequenceOffset?: number, groupField?: string, groupValue?: any }} [options] - The rank of the first
     *   id in the whole list, and the group the ids are moved to
     * @returns {Promise<void>}
     */
    const resequence = async (ids, options = {}) => {
        if (!isSortable.value || !sortableField.value) {
            console.warn('[useSortable] Resequencing is not enabled');
            return;
        }

        await sendOrder(modelName, ids, { ...options, sequenceField: sortableField.value });
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
        readMetadata,
        ready,
    };
}
