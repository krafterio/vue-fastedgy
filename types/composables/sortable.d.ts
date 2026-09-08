/**
 * Composable for drag & drop resequencing functionality
 *
 * @param {string} modelName - API model name
 * @param {object|Promise<object>} metadata - Model metadata from metadata store, which hands it back as a promise
 * @param {boolean|undefined} sortableConfig - Sortable configuration override
 * @returns {Object} Sortable state and methods, `ready` settling once the metadata is read
 */
export declare function useSortable(modelName: string, metadata: object | Promise<object>, sortableConfig: boolean | undefined): any;
//# sourceMappingURL=sortable.d.ts.map