/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { computed, getCurrentScope, onScopeDispose, ref, shallowRef } from 'vue';
import { bus } from './bus.js';
import { useDataIterator } from './data-iterator.js';
import { RESOURCES_STALE } from './realtime.js';
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
 * @returns {Object} - The data iterator, with `columns`: the columns declared, or, once `useColumnLayout` is given the
 *   table, those its users choose (a declared column an entry names, at the width of the entry, else the column of its
 *   field)
 */
export function useDataTable(model, options = {}) {
    const metadataStore = useMetadataStore();
    const metadatas = ref(null);

    // The store answers with a promise: read the map, and let the columns
    // enrich themselves when it lands rather than never.
    const readMetadatas = () =>
        Promise.resolve(metadataStore.getMetadatas()).then(
            (all) => {
                metadatas.value = all || {};
            },
            () => {
                metadatas.value = {};
            }
        );

    void readMetadatas();

    // Another workspace has metadata of its own: the columns are resolved again
    // from it, before the list, which waits for the same read, reads its rows.
    const born = performance.now();

    const onSwitch = (event) => {
        if ((event?.detail?.since ?? Infinity) >= born) {
            void readMetadatas();
        }
    };

    bus.addEventListener(RESOURCES_STALE, onSwitch);

    if (getCurrentScope()) {
        onScopeDispose(() => bus.removeEventListener(RESOURCES_STALE, onSwitch));
    }

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

        // A computed field is not stored: the server leaves it out of an order without a word.
        const sortable = field.type !== 'computed' && field.sortable !== false;

        return {
            ...column,
            sortable: column.sortable !== undefined ? column.sortable : sortable,
            type: column.type || field.type || 'string',
            meta: field,
        };
    };

    // The columns its users choose, once a column layout is given the table.
    const layout = shallowRef(null);

    const columns = computed(() => {
        const declared = options.columns || [];
        const metadata = metadataOf(typeof model === 'string' ? model : model.modelName);
        const shown = layout.value
            ? layout.value.entries.value.map((entry) => {
                  const column = declared.find((one) => one.key === entry.name) ?? {
                      key: entry.name,
                      label: metadata?.fields?.[entry.name]?.label ?? entry.name,
                  };

                  return entry.width ? { ...column, width: entry.width } : column;
              })
            : declared;

        return metadata ? shown.map((column) => enrichColumn(column, metadata)) : shown;
    });

    const iterator = useDataIterator(model, {
        ...options,
        layout,
        fieldsResolver: () => [...columns.value.map((column) => column.key), ...(options.additionalFields || [])],
        pageSize: options.pageSize || 100,
        availablePageSizes: options.availablePageSizes || [25, 50, 100, 150, 200],
        pageSizeKey: options.pageSizeKey || 'datatable-page-size',
    });

    return Object.assign({}, iterator, { columns });
}
