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
 *  uploadModelField: (model: string, id: string|number, field: string, file: File) => Promise<string|null>,
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
     * @param {{ prefix?: string }} [options]
     * @returns {string|null} - Null for an empty field, so a caller can test the URL itself
     */
    function fileUrl(path, options = {}) {
        return path ? `${base(options.prefix)}/storage/download/${path}` : null;
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

    return { fileUrl, uploadModelField, deleteModelField };
}
