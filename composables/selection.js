/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { ref, reactive } from 'vue';

/**
 * Composable for managing row selection in data iterators
 *
 * @param {Object} options - Configuration options
 * @param {boolean} [options.enabled=false] - Whether selection is enabled
 * @param {import('vue').Ref<Array>} options.items - Reference to current items
 * @param {import('vue').Ref<number>} options.total - Reference to total count
 * @returns {Object} Selection state and methods
 */
export function useSelection({ enabled = false, items, total }) {
    const isSelectionEnabled = ref(enabled);
    const selectedIds = ref(new Set());
    const selectAllRecords = ref(false);

    // In the all mode, the rows unchecked one by one: every record of the filter
    // is selected but them, and an action on the selection sends the filter with
    // ['id', 'not in', excluded].
    const excludedIds = ref(new Set());

    /**
     * Selection object exposed to components
     * Provides methods and reactive state for selection management
     */
    const selection = reactive({
        /**
         * List of selected IDs (reactive array)
         */
        get ids() {
            return Array.from(selectedIds.value);
        },
        set ids(value) {
            selectedIds.value = new Set(Array.isArray(value) ? value : [value]);
        },

        /**
         * Whether "select all records" mode is enabled
         * When true, all records matching current filters are selected
         */
        get all() {
            return selectAllRecords.value;
        },
        set all(value) {
            selectAllRecords.value = !!value;
            excludedIds.value = new Set();
            if (value) {
                selectedIds.value.clear();
            }
        },

        /**
         * IDs unchecked while in "all" mode, every other record matching the filters staying selected
         */
        get excluded() {
            return Array.from(excludedIds.value);
        },

        /**
         * Get count of selected items
         * @returns {number} - Number of selected items, or total less the unchecked ones if "all" mode
         */
        get count() {
            if (selectAllRecords.value) {
                return total.value - excludedIds.value.size;
            }
            return selectedIds.value.size;
        },

        /**
         * Check if all visible items on current page are selected
         * @returns {boolean}
         */
        get isAllVisibleSelected() {
            if (items.value.length === 0) return false;
            return items.value.every((item) => this.has(item.id));
        },

        /**
         * Check if we should show "Select All" button
         * @returns {boolean}
         */
        get shouldShowSelectAllButton() {
            return this.isAllVisibleSelected && !selectAllRecords.value && total.value > items.value.length;
        },

        /**
         * Add one or more IDs to selection
         * @param {Array<string|number>|string|number} ids - ID(s) to add
         */
        add(ids) {
            const idArray = Array.isArray(ids) ? ids : [ids];

            if (selectAllRecords.value) {
                excludedIds.value = new Set([...excludedIds.value].filter((id) => !idArray.includes(id)));
                return;
            }

            idArray.forEach((id) => selectedIds.value.add(id));
            selectedIds.value = new Set(selectedIds.value);
        },

        /**
         * Remove one or more IDs from selection
         * @param {Array<string|number>|string|number} ids - ID(s) to remove
         */
        remove(ids) {
            const idArray = Array.isArray(ids) ? ids : [ids];

            if (selectAllRecords.value) {
                excludedIds.value = new Set([...excludedIds.value, ...idArray]);
                return;
            }

            idArray.forEach((id) => selectedIds.value.delete(id));
            selectedIds.value = new Set(selectedIds.value);
        },

        /**
         * Check if an ID is selected
         * @param {string|number} id - ID to check
         * @returns {boolean}
         */
        has(id) {
            if (selectAllRecords.value) {
                return !excludedIds.value.has(id);
            }
            return selectedIds.value.has(id);
        },

        /**
         * Clear all selections
         */
        clear() {
            selectedIds.value.clear();
            selectAllRecords.value = false;
            excludedIds.value = new Set();
        },

        /**
         * Toggle selection of an item
         * @param {string|number} id - ID to toggle
         */
        toggle(id) {
            if (this.has(id)) {
                this.remove(id);
            } else {
                this.add(id);
            }
        },

        /**
         * Select all visible items on current page
         */
        selectAllVisible() {
            this.add(items.value.map((item) => item.id));
        },

        /**
         * Toggle "select all records" mode
         */
        toggleAll() {
            selectAllRecords.value = !selectAllRecords.value;
            excludedIds.value = new Set();
            if (selectAllRecords.value) {
                selectedIds.value.clear();
            }
        },
    });

    return {
        isSelectionEnabled,
        selection,
    };
}
