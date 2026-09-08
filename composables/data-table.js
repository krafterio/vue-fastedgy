/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { computed, ref } from 'vue';
import { useDataIterator } from './data-iterator.js';
import { useMetadataStore } from '../stores/metadata.js';

/**
 * A list read as columns: the data iterator, plus the columns it reads.
 *
 * @param {string|object} model - Model name or an api model (useXxxApiModel())
 * @param {Object} options - Configuration options
 * @param {Array} options.columns - Column definitions [{key, label, width, sortable, type}, ...]
 * @param {Array} options.additionalFields - Fields to read without showing them
 * @param {number} options.pageSize - Default items per page (default: 100, remembered)
 * @param {Array} options.availablePageSizes - Available page sizes (default: [25, 50, 100, 150, 200])
 * @param {Array<string>} options.defaultOrderBy - Default sort ['field:asc', 'field2:desc']
 * @param {Array<string>} options.exportFields - Fields to export (default: the columns)
 * @param {Array|Function} options.filter - Restrictive filters to always apply
 * @param {string} options.prefix - Prefix for the API
 * @param {Object} options.headers - Custom headers for API requests
 * @param {boolean} options.orderable - Enable column sorting (default: true)
 * @param {boolean} options.enableSelection - Enable row selection (default: false)
 * @returns {Object} - The data iterator, with `columns`
 */
export function useDataTable(model, options = {}) {
    const metadataStore = useMetadataStore();
    const metadatas = ref(null);

    // The store answers with a promise: read the map once, and let the columns
    // enrich themselves when it lands rather than never.
    void Promise.resolve(metadataStore.getMetadatas()).then(
        (all) => {
            metadatas.value = all || {};
        },
        () => {
            metadatas.value = {};
        }
    );

    const metadataOf = (name) => metadatas.value?.[name] || null;

    /**
     * Take from the metadata what the column did not say: its type, whether it sorts.
     */
    const enrichColumn = (column, metadata) => {
        if (!metadata?.fields) {
            return column;
        }

        const path = column.key.split('.');
        let field = metadata.fields[path[0]];

        for (let index = 1; index < path.length && field; index++) {
            field = field.target ? metadataOf(field.target)?.fields?.[path[index]] : null;
        }

        if (!field) {
            return column;
        }

        return {
            ...column,
            sortable: column.sortable !== undefined ? column.sortable : field.sortable !== false,
            type: column.type || field.type || 'string',
            meta: field,
        };
    };

    const columns = computed(() => {
        const declared = options.columns || [];
        const metadata = metadataOf(typeof model === 'string' ? model : model.modelName);

        return metadata ? declared.map((column) => enrichColumn(column, metadata)) : declared;
    });

    const iterator = useDataIterator(model, {
        ...options,
        fieldsResolver: () => [...columns.value.map((column) => column.key), ...(options.additionalFields || [])],
        pageSize: options.pageSize || 100,
        availablePageSizes: options.availablePageSizes || [25, 50, 100, 150, 200],
        pageSizeKey: options.pageSizeKey || 'datatable-page-size',
    });

    return Object.assign({}, iterator, { columns });
}
