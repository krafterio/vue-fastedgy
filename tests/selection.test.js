/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { useSelection } from '../composables/selection.js';

const rows = (...ids) => ref(ids.map((id) => ({ id })));

describe('useSelection', () => {
    it('keeps every record selected but the rows unchecked in the all mode', () => {
        const { selection } = useSelection({ enabled: true, items: rows(1, 2, 3), total: ref(40) });

        selection.all = true;
        selection.toggle(2);

        expect(selection.all).toBe(true);
        expect(selection.has(1)).toBe(true);
        expect(selection.has(2)).toBe(false);
        expect(selection.excluded).toEqual([2]);
        expect(selection.count).toBe(39);
        expect(selection.isAllVisibleSelected).toBe(false);

        selection.toggle(2);

        expect(selection.excluded).toEqual([]);
        expect(selection.count).toBe(40);
    });

    it('forgets the rows unchecked when the all mode ends or the selection is cleared', () => {
        const { selection } = useSelection({ enabled: true, items: rows(1, 2), total: ref(40) });

        selection.all = true;
        selection.remove([1, 2]);
        selection.toggleAll();

        expect(selection.all).toBe(false);
        expect(selection.excluded).toEqual([]);
        expect(selection.count).toBe(0);

        selection.toggleAll();
        selection.remove(1);
        selection.clear();

        expect(selection.all).toBe(false);
        expect(selection.excluded).toEqual([]);
        expect(selection.ids).toEqual([]);
    });

    it('checks the visible rows again in the all mode by taking them out of the unchecked ones', () => {
        const { selection } = useSelection({ enabled: true, items: rows(1, 2), total: ref(40) });

        selection.all = true;
        selection.remove([1, 2]);
        selection.selectAllVisible();

        expect(selection.all).toBe(true);
        expect(selection.excluded).toEqual([]);
        expect(selection.isAllVisibleSelected).toBe(true);
    });
});
