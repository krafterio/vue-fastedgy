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

describe('useStorage attachment url', () => {
    it('reads an attachment by its id', () => {
        const { attachmentUrl } = useStorage();

        expect(attachmentUrl(7)).toBe('/storage/download/attachments/7');
        expect(attachmentUrl(7, { params: { force_download: true } })).toBe(
            '/storage/download/attachments/7?force_download=true'
        );
    });
});

describe('useStorage attachments', () => {
    it('stores files that answer for themselves', async () => {
        const fetchSpy = vi.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({ attachments: [{ id: 1 }, { id: 2 }] }),
            })
        );

        window.fetch = fetchSpy;

        const { uploadAttachments } = useStorage();
        const attachments = await uploadAttachments([
            new File(['a'], 'a.png', { type: 'image/png' }),
            new File(['b'], 'b.png', { type: 'image/png' }),
        ]);

        const [url, options] = fetchSpy.mock.calls[0];

        expect(url).toBe('/storage/upload/attachments');
        expect(options.body).toBeInstanceOf(FormData);
        expect([...options.body.keys()]).toEqual(['a.png', 'b.png']);
        expect(attachments).toEqual([{ id: 1 }, { id: 2 }]);
    });
});
