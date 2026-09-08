/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useApiForm } from '../composables/api.js';

const record = (data) => Promise.resolve({ data });

describe('useApiForm', () => {
    let api;

    beforeEach(() => {
        api = {
            create: vi.fn(() => record({ id: 7, name: 'Krafter' })),
            update: vi.fn(() => record({ id: 7, name: 'Krafter SAS' })),
            delete: vi.fn(() => Promise.resolve()),
        };
    });

    it('creates a record that has no id', async () => {
        const { save } = useApiForm(api);

        const saved = await save(null, { name: 'Krafter' });

        expect(api.create).toHaveBeenCalledWith({ name: 'Krafter' }, {});
        expect(api.update).not.toHaveBeenCalled();
        expect(saved).toEqual({ id: 7, name: 'Krafter' });
    });

    it('updates a record that has one', async () => {
        const { save } = useApiForm(api, { fields: ['name'] });

        const saved = await save(7, { name: 'Krafter SAS' });

        expect(api.update).toHaveBeenCalledWith(7, { name: 'Krafter SAS' }, { fields: ['name'] });
        expect(saved).toEqual({ id: 7, name: 'Krafter SAS' });
    });

    it('says while it writes, and not twice at once', async () => {
        const { saving, save } = useApiForm(api);

        const first = save(null, { name: 'Krafter' });

        expect(saving.value).toBe(true);

        await save(null, { name: 'Another' });
        await first;

        expect(api.create).toHaveBeenCalledTimes(1);
        expect(saving.value).toBe(false);
    });

    it('deletes the record it is pointed at', async () => {
        const { remove } = useApiForm(api);

        await remove(7);

        expect(api.delete).toHaveBeenCalledWith(7);
    });
});
