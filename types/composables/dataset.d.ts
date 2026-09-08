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
export function useDataset(defaultParams?: {
    prefix?: string;
}): {
    resequence: (modelName: string, ids: Array<number>, options?: any) => Promise<any>;
};
//# sourceMappingURL=dataset.d.ts.map