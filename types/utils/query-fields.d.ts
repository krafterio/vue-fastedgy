/**
 * Whether a field leads to one related record, to several, or is no relation.
 *
 * @param {import('../stores/metadata.js').MetadataField|null|undefined} field
 * @returns {'single'|'multiple'|null}
 */
export declare function relationKindOf(field: import('../stores/metadata.js').MetadataField | null | undefined): 'single' | 'multiple' | null;
/**
 * Whether a list groups its rows by a field: one with choices, a boolean or a
 * single relation. Any other field would need the server to say which values
 * hold rows at all.
 *
 * @param {import('../stores/metadata.js').MetadataField|null|undefined} field
 * @returns {boolean}
 */
export declare function isGroupable(field: import('../stores/metadata.js').MetadataField | null | undefined): boolean;
/**
 * The fields a filter can be built on, in the order the metadata gives them.
 *
 * A field is offered when the server filters on it and it is not a technical
 * column: `id` is the record itself, and under a relation the relation itself.
 *
 * @param {import('../stores/metadata.js').MetadataModel|null|undefined} metadata
 * @param {{ exclude?: Array<string>, prefix?: string }} [options] - Paths left out, and the path of the level read
 * @returns {Array<import('../stores/metadata.js').MetadataField>}
 */
export declare function filterableFields(metadata: import('../stores/metadata.js').MetadataModel | null | undefined, { exclude, prefix }?: {
    exclude?: Array<string>;
    prefix?: string;
}): Array<import('../stores/metadata.js').MetadataField>;
/**
 * Walk a path through the metadata: each field it crosses, the last one, and
 * the model it reaches. A relation and its key are one field, so `owner.id`
 * resolves as `owner`.
 *
 * @param {Record<string, import('../stores/metadata.js').MetadataModel>|null|undefined} metadatas
 * @param {string} model - The metadata name of the model the path starts from
 * @param {string} path
 * @returns {{ path: string, chain: Array<{ model: string, field: import('../stores/metadata.js').MetadataField }>, field: import('../stores/metadata.js').MetadataField, model: string, target: string|null }|null}
 */
export declare function resolveFieldPath(metadatas: Record<string, import('../stores/metadata.js').MetadataModel> | null | undefined, model: string, path: string): {
    path: string;
    chain: Array<{
        model: string;
        field: import('../stores/metadata.js').MetadataField;
    }>;
    field: import('../stores/metadata.js').MetadataField;
    model: string;
    target: string | null;
} | null;
/**
 * The operators the server accepts on a field. A relation takes those of its
 * key as well: comparing a relation is comparing the key it holds.
 *
 * @param {Record<string, import('../stores/metadata.js').MetadataModel>|null|undefined} metadatas
 * @param {import('../stores/metadata.js').MetadataField|null|undefined} field
 * @returns {Array<string>}
 */
export declare function fieldOperators(metadatas: Record<string, import('../stores/metadata.js').MetadataModel> | null | undefined, field: import('../stores/metadata.js').MetadataField | null | undefined): Array<string>;
//# sourceMappingURL=query-fields.d.ts.map