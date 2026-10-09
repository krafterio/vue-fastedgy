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
export type MetadataScope = {
    /**
     * What the metadatas read are kept under
     */
    scope: string;
    /**
     * The prefix they are read under
     */
    prefix: string;
};
/**
 * Keep the metadatas by scope rather than as one set: [resolver] says, from
 * the prefix the application set, which scope it reads in and the prefix to
 * read it under. Coming back to a scope reads nothing. Whatever knows the
 * scope injects it (the workspaces do, see `createWorkspaces`); `null` goes
 * back to one set.
 *
 * @param {((prefix: string) => MetadataScope|Promise<MetadataScope>)|null} resolver
 */
export declare function setMetadataScope(resolver: ((prefix: string) => MetadataScope | Promise<MetadataScope>) | null): void;
export declare const useMetadataStore: import("pinia").SetupStoreDefinition<"metadata", {
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<null, null>;
    prefix: import("vue").Ref<null, null>;
    setPrefix: (newPrefix: any) => void;
    getPrefix: () => null;
    readScope: (scope: string, scopePrefix: string, { again, asked }?: {
        again?: boolean;
        asked?: number;
    }) => Promise<any>;
    fetchMetadatas: () => Promise<any>;
    setMetadatas: (newMetadatas: any) => void;
    getMetadatas: () => Promise<any>;
    getMetadata: (modelName: string) => Promise<MetadataModel | null>;
}>;
//# sourceMappingURL=metadata.d.ts.map