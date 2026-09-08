/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { resolveWidget, useApiModelForm } from '../composables/api-model-form.js';
import { useMetadataStore } from '../stores/metadata.js';

const METADATA = {
    fields: {
        id: { type: 'integer' },
        name: { type: 'string', label: 'Nom', required: true },
        note: { type: 'text' },
        active: { type: 'boolean' },
        author: { type: 'foreignkey', target: 'user' },
        created_at: { type: 'datetime' },
    },
};

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('resolveWidget', () => {
    it('names the input a field type asks for', () => {
        expect(resolveWidget({ type: 'text' })).toBe('textarea');
        expect(resolveWidget({ type: 'boolean' })).toBe('switch');
        expect(resolveWidget({ type: 'foreignkey' })).toBe('relation');
        expect(resolveWidget({ type: 'manytomany' })).toBe('relations');
    });

    it('offers a choice list whatever the type says', () => {
        expect(resolveWidget({ type: 'string', choices: { a: 'A' } })).toBe('choice');
    });

    it('falls back on a text input rather than breaking the screen', () => {
        expect(resolveWidget({ type: 'something_new' })).toBe('text');
    });
});

describe('useApiModelForm', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        useMetadataStore().setMetadatas({ article: METADATA });
    });

    it('builds the editable fields from the metadata, leaving the read-only columns out', async () => {
        const form = useApiModelForm('article');

        await form.start();

        expect(form.fields.value.map((field) => field.name)).toEqual(['name', 'note', 'active', 'author']);
        expect(form.fields.value[0]).toMatchObject({ label: 'Nom', widget: 'text', required: true });
    });

    it('seeds the values with the record it is given, a relation by its id', async () => {
        const form = useApiModelForm('article');

        await form.start();
        form.reset({ id: 3, name: 'Sel', author: { id: 7, name: 'Fab' } });
        await settled();

        expect(form.values.name).toBe('Sel');
        expect(form.values.author).toBe(7);
    });

    it('starts a new record on the defaults the caller named', async () => {
        const form = useApiModelForm('article', { defaults: { active: true } });

        await form.start();
        await settled();

        expect(form.values.active).toBe(true);
        expect(form.values.name).toBe(null);
    });
});
