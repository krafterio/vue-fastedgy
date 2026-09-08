/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { useFetcherService } from './fetcher.js';

/**
 * Dataset actions the server exposes for every registered model.
 *
 * @param {{ prefix?: string }} [defaultParams] - Default parameters
 * @returns {{ resequence: (modelName: string, ids: Array<number>, options?: Object) => Promise<Object> }}
 *
 * @example
 * const { resequence } = useDataset();
 *
 * await resequence('aisle', [3, 1, 2]);
 */
export function useDataset(defaultParams = {}) {
    const fetcher = useFetcherService();

    /**
     * Give a list the order the ids are in, and optionally move them to another group.
     *
     * @param {string} modelName - Model name: metadata 'name' or 'api_name'
     * @param {Array<number>} ids - Record ids, in the wanted order
     * @param {{ sequenceField?: string, sequenceOffset?: number, groupField?: string, groupValue?: any, prefix?: string }} [options]
     * @returns {Promise<{model_name: string, records: Array<Object>}>}
     */
    async function resequence(modelName, ids, options = {}) {
        const {
            sequenceField = 'sequence',
            sequenceOffset = 0,
            groupField = null,
            groupValue = null,
            prefix = defaultParams.prefix,
        } = options;

        const body = {
            model_name: modelName,
            ids,
            sequence_field: sequenceField,
            sequence_offset: sequenceOffset,
        };

        // A group reassignment needs both halves: the field to write and the value to write in it.
        if (groupField != null) {
            body.group_field = groupField;
            body.group_value = groupValue;
        }

        const response = await fetcher.put(`${prefix || ''}/dataset/resequence`, body);

        return response?.data ?? null;
    }

    return { resequence };
}
