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