/**
 * Composable for drag & drop resequencing functionality
 *
 * @param {string} modelName - API model name
 * @param {Object|Promise<Object>} metadata - Model metadata from metadata store, which hands it back as a promise
 * @param {boolean|undefined} sortableConfig - Sortable configuration override
 * @returns {Object} Sortable state and methods, `ready` settling once the metadata is read
 */
export function useSortable(modelName: string, metadata: any | Promise<any>, sortableConfig: boolean | undefined): any;
//# sourceMappingURL=sortable.d.ts.map