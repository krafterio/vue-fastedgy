/**
 * Say that what this store holds is not what the application reads any more.
 *
 * What a metadata describes depends on who is reading it: a tenant adds its own
 * fields to a model, and the next one adds others. Whatever knows that changed
 * announces it here, and the store reads again when it is next asked, rather
 * than depending on something it knows nothing about.
 *
 * @type {String}
 *
 * @example
 * bus.trigger(METADATA_INVALIDATED);
 */
export declare const METADATA_INVALIDATED: string;
export type MetadataField = {
    name: string;
    label: string;
    type: string;
    readonly: boolean;
    required: boolean;
    searchable: boolean;
    /**
     * A field a workspace added to the model
     */
    extra: boolean;
    filter_operators: Array<string>;
    target?: string | null;
    targets?: Array<string> | null;
    choices?: Record<string, string> | null;
    /**
     * The static value a new record starts with; null when
     * the server computes it on save
     */
    default?: any;
    local_placeholder?: string | null;
};
export type MetadataModel = {
    name: string;
    api_name: string;
    label: string;
    label_plural: string;
    has_extra_fields: boolean;
    fields: Record<string, MetadataField>;
};
/**
 * @typedef {Object} MetadataField
 * @property {string} name
 * @property {string} label
 * @property {string} type
 * @property {boolean} readonly
 * @property {boolean} required
 * @property {boolean} searchable
 * @property {boolean} extra A field a workspace added to the model
 * @property {Array<string>} filter_operators
 * @property {string|null} [target]
 * @property {Array<string>|null} [targets]
 * @property {Record<string, string>|null} [choices]
 * @property {any} [default] The static value a new record starts with; null when
 *   the server computes it on save
 * @property {string|null} [local_placeholder]
 */
/**
 * @typedef {Object} MetadataModel
 * @property {string} name
 * @property {string} api_name
 * @property {string} label
 * @property {string} label_plural
 * @property {boolean} has_extra_fields
 * @property {Record<string, MetadataField>} fields
 */
export declare const useMetadataStore: import("pinia").SetupStoreDefinition<"metadata", {
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<null, null>;
    prefix: import("vue").Ref<null, null>;
    setPrefix: (newPrefix: any) => void;
    getPrefix: () => null;
    fetchMetadatas: () => Promise<void>;
    setMetadatas: (newMetadatas: any) => void;
    getMetadatas: () => Promise<null>;
    getMetadata: (modelName: string) => Promise<MetadataModel | null>;
}>;
//# sourceMappingURL=metadata.d.ts.map