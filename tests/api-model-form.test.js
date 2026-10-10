/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveWidget, useApiModelForm } from '../composables/api-model-form.js';
import { useMetadataStore } from '../stores/metadata.js';

const METADATA = {
    fields: {
        id: { type: 'integer' },
        name: { type: 'string', label: 'Nom', required: true },
        note: { type: 'text' },
        active: { type: 'boolean', default: true },
        author: { type: 'foreignkey', target: 'user' },
        created_at: { type: 'datetime' },
        extra_stage: { type: 'string', extra: true, default: 'Seed' },
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

    it('names the input of the field types the server generates', () => {
        expect(resolveWidget({ type: 'char' })).toBe('text');
        expect(resolveWidget({ type: 'u_r_l' })).toBe('text');
        expect(resolveWidget({ type: 'small_integer' })).toBe('number');
        expect(resolveWidget({ type: 'big_integer' })).toBe('number');
        expect(resolveWidget({ type: 'many2one' })).toBe('relation');
        expect(resolveWidget({ type: 'one2one' })).toBe('relation');
        expect(resolveWidget({ type: 'many2many' })).toBe('relations');
    });
});

describe('useApiModelForm', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        useMetadataStore().setMetadatas({ article: METADATA });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('puts each field the server refuses next to its input', async () => {
        vi.spyOn(window, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ detail: [{ loc: ['body', 'name'], msg: 'Field required' }] }), {
                status: 422,
                headers: { 'Content-Type': 'application/json' },
            })
        );
        const form = useApiModelForm('article');

        await form.start();
        await expect(form.save()).rejects.toBeTruthy();

        expect(form.errors.value).toEqual({ name: 'Field required' });
        expect(form.status.value).toBe('error');
    });

    it('builds the editable fields from the metadata, leaving the read-only columns out', async () => {
        const form = useApiModelForm('article');

        await form.start();

        expect(form.fields.value.map((field) => field.name)).toEqual([
            'name',
            'note',
            'active',
            'author',
            'extra_stage',
        ]);
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

    it('exposes the declared defaults and leaves them to the server', async () => {
        const form = useApiModelForm('article');

        await form.start();
        await settled();

        const defaultOf = (name) => form.fields.value.find((field) => field.name === name)?.default;

        expect(defaultOf('active')).toBe(true);
        expect(defaultOf('extra_stage')).toBe('Seed');
        expect(defaultOf('name')).toBe(null);
        expect(form.values.active).toBe(null);
        expect(form.values.extra_stage).toBe(null);
    });
});
