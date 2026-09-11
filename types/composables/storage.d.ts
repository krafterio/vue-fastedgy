/**
 * Say once where the application keeps its files.
 *
 * What a package reads through `useStorage()` without naming a surface goes
 * there too: an application whose files live under its workspace gets an editor
 * that stores its pictures there, without handing it a prefix call by call.
 *
 * @param {{ prefix?: string }} config
 * @returns {import("vue").Plugin}
 *
 * @example
 * // In main.js
 * app.use(createStorage({ prefix: '/{workspace}' }));
 */
export declare function createStorage(config?: {
    prefix?: string;
}): import("vue").Plugin;
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
export declare function useStorage(defaultParams?: {
    prefix?: string;
}): {
    fileUrl: (path: string | null) => string | null;
    attachmentUrl: (id: string | number) => string;
    uploadModelField: (model: string, id: string | number, field: string, file: File) => Promise<string | null>;
    uploadAttachments: (files: File[], options?: {
        meta?: object;
        prefix?: string;
    }) => Promise<Array<object>>;
    deleteModelField: (model: string, id: string | number, field: string) => Promise<void>;
};
//# sourceMappingURL=storage.d.ts.map