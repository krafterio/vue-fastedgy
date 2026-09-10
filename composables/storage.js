/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { useFetcherService } from './fetcher.js';

/**
 * Files a model field holds: where to read one, how to replace it, how to drop it.
 *
 * @param {{ prefix?: string }} [defaultParams] - Default parameters
 * @returns {{
 *  fileUrl: (path: string|null) => string|null,
 *  attachmentUrl: (id: string|number) => string,
 *  uploadModelField: (model: string, id: string|number, field: string, file: File) => Promise<string|null>,
 *  uploadAttachments: (files: File[], options?: { meta?: object, prefix?: string }) => Promise<Array<object>>,
 *  deleteModelField: (model: string, id: string|number, field: string) => Promise<void>
 * }}
 *
 * @example
 * const { fileUrl, uploadModelField } = useStorage();
 *
 * const path = await uploadModelField('aliment', aliment.id, 'image', file);
 * const src = fileUrl(path);
 */
export function useStorage(defaultParams = {}) {
    const fetcher = useFetcherService();
    const base = (prefix) => (prefix === undefined ? defaultParams.prefix : prefix) || '';

    /**
     * URL a stored file is read from, to be given to `v-fetcher-src` or to the fetcher.
     *
     * @param {string|null} path - Stored path, as the model field holds it
     * @param {{ prefix?: string, params?: object }} [options] - `params` is what the
     *        route reads on its own: a size, a format, a download rather than a display
     * @returns {string|null} - Null for an empty field, so a caller can test the URL itself
     *
     * @example
     * fileUrl(aliment.image);
     * fileUrl(ticket.image, { params: { force_download: true } });
     */
    function fileUrl(path, options = {}) {
        if (!path) {
            return null;
        }

        const url = `${base(options.prefix)}/storage/download/${path}`;
        const query = new URLSearchParams(
            Object.entries(options.params || {}).filter(([, value]) => value !== undefined && value !== null)
        ).toString();

        return query ? `${url}?${query}` : url;
    }

    /**
     * URL an attachment is read from.
     *
     * @param {string|number} id
     * @param {{ prefix?: string, params?: object }} [options]
     * @returns {string}
     */
    function attachmentUrl(id, options = {}) {
        return fileUrl(`attachments/${id}`, options);
    }

    /**
     * Write a file in a model field, replacing what it held.
     *
     * @param {string} model - Model name: metadata 'name' or 'api_name'
     * @param {string|number} id - Record id
     * @param {string} field - Field holding the file
     * @param {File} file - File to store
     * @param {{ prefix?: string }} [options]
     * @returns {Promise<string|null>} - Stored path, which the field now holds
     */
    async function uploadModelField(model, id, field, file, options = {}) {
        const body = new FormData();

        body.append('file', file);

        const response = await fetcher.post(`${base(options.prefix)}/storage/upload/${model}/${id}/${field}`, body);

        return response?.data?.path ?? null;
    }

    /**
     * Store files as attachments, which answer for themselves rather than for a field.
     *
     * @param {File[]|FileList} files
     * @param {{ prefix?: string }} [options]
     * @returns {Promise<Array<object>>} - The attachments the server created
     */
    async function uploadAttachments(files, options = {}) {
        const body = new FormData();

        for (const file of files) {
            body.append(file.name, file);
        }

        // What the files are, said in the same pass as the upload: the record
        // they belong to, and the field whose text holds them. Sent apart, the
        // server would have written rows nothing points at.
        if (options.meta) {
            body.append('meta', JSON.stringify(options.meta));
        }

        const response = await fetcher.post(`${base(options.prefix)}/storage/upload/attachments`, body);

        return response?.data?.attachments ?? [];
    }

    /**
     * Empty a model field of the file it holds.
     *
     * @param {string} model - Model name: metadata 'name' or 'api_name'
     * @param {string|number} id - Record id
     * @param {string} field - Field holding the file
     * @param {{ prefix?: string }} [options]
     * @returns {Promise<void>}
     */
    async function deleteModelField(model, id, field, options = {}) {
        await fetcher.delete(`${base(options.prefix)}/storage/file/${model}/${id}/${field}`);
    }

    return { fileUrl, attachmentUrl, uploadModelField, uploadAttachments, deleteModelField };
}
