/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStorage } from '../composables/storage.js';

const jsonResponse = (payload) => ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => payload,
});

describe('useStorage', () => {
    let fetchSpy;

    beforeEach(() => {
        fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ path: 'aliments/7/image.png' }));
        window.fetch = fetchSpy;
    });

    it('reads a stored file on the download path', () => {
        const { fileUrl } = useStorage();

        expect(fileUrl('aliments/7/image.png')).toBe('/storage/download/aliments/7/image.png');
    });

    it('hands back nothing for a field holding nothing', () => {
        const { fileUrl } = useStorage();

        expect(fileUrl(null)).toBeNull();
        expect(fileUrl('')).toBeNull();
    });

    it('writes a file in a model field and hands back the stored path', async () => {
        const { uploadModelField } = useStorage();
        const file = new File(['png'], 'image.png', { type: 'image/png' });

        const path = await uploadModelField('aliment', 7, 'image', file);
        const [url, options] = fetchSpy.mock.calls[0];

        expect(url).toBe('/storage/upload/aliment/7/image');
        expect(options.method).toBe('POST');
        expect(options.body).toBeInstanceOf(FormData);
        expect(options.body.get('file')).toBe(file);
        expect(path).toBe('aliments/7/image.png');
    });

    it('empties a model field on the path the server keeps for it', async () => {
        const { deleteModelField } = useStorage();

        await deleteModelField('aliment', 7, 'image');
        const [url, options] = fetchSpy.mock.calls[0];

        expect(url).toBe('/storage/file/aliment/7/image');
        expect(options.method).toBe('DELETE');
    });
});

describe('useStorage file url', () => {
    it('carries what the download route reads on its own', () => {
        const { fileUrl } = useStorage();

        expect(fileUrl('a.png', { params: { w: 600, m: 'contain' } })).toBe('/storage/download/a.png?w=600&m=contain');
        expect(fileUrl('a.png', { params: { e: undefined } })).toBe('/storage/download/a.png');
    });

    it('reads from the surface it is given', () => {
        const { fileUrl } = useStorage();

        expect(fileUrl('a.png', { prefix: '/public/lists/abc' })).toBe('/public/lists/abc/storage/download/a.png');
    });
});
