/**
 * Composable for managing row selection in data iterators
 *
 * @param {Object} options - Configuration options
 * @param {boolean} [options.enabled=false] - Whether selection is enabled
 * @param {import('vue').Ref<Array>} options.items - Reference to current items
 * @param {import('vue').Ref<number>} options.total - Reference to total count
 * @returns {Object} Selection state and methods
 */
export function useSelection({ enabled, items, total }: {
    enabled?: boolean;
    items: import("vue").Ref<any[]>;
    total: import("vue").Ref<number>;
}): any;
//# sourceMappingURL=selection.d.ts.map