export declare const useMetadataStore: import("pinia").SetupStoreDefinition<"metadata", {
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<null, null>;
    prefix: import("vue").Ref<null, null>;
    setPrefix: (newPrefix: any) => void;
    getPrefix: () => null;
    fetchMetadatas: () => Promise<void>;
    getMetadatas: () => Promise<null>;
    getMetadata: (modelName: any) => Promise<any>;
}>;
//# sourceMappingURL=metadata.d.ts.map