/**
 * Composable for drag & drop resequencing functionality
 *
 * @param {string} modelName - API model name
 * @param {object|Promise<object>} metadata - Model metadata from metadata store, which hands it back as a promise
 * @param {boolean|undefined} sortableConfig - Sortable configuration override
 * @param {{prefix?: string}} [options] - Where the dataset routes answer, when they are not at the root
 * @returns {Object} Sortable state and methods, `ready` settling once the metadata is read
 */
export declare function useSortable(modelName: string, metadata: object | Promise<object>, sortableConfig: boolean | undefined, options?: {
    prefix?: string;
}): any;
//# sourceMappingURL=sortable.d.ts.map