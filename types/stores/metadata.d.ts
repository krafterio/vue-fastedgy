export const useMetadataStore: import("pinia").SetupStoreDefinition<"metadata", {
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<any, any>;
    prefix: import("vue").Ref<any, any>;
    setPrefix: (newPrefix: any) => void;
    getPrefix: () => any;
    fetchMetadatas: () => Promise<void>;
    getMetadatas: () => Promise<any>;
    getMetadata: (modelName: any) => Promise<any>;
}>;
//# sourceMappingURL=metadata.d.ts.map