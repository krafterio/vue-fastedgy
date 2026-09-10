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
export declare const useMetadataStore: import("pinia").SetupStoreDefinition<"metadata", {
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<null, null>;
    prefix: import("vue").Ref<null, null>;
    setPrefix: (newPrefix: any) => void;
    getPrefix: () => null;
    fetchMetadatas: () => Promise<void>;
    setMetadatas: (newMetadatas: any) => void;
    getMetadatas: () => Promise<null>;
    getMetadata: (modelName: any) => Promise<any>;
}>;
//# sourceMappingURL=metadata.d.ts.map