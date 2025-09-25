export const useMetadataStore: import("pinia").StoreDefinition<"metadata", Pick<{
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<any, any>;
    fetchMetadatas: () => Promise<void>;
    getMetadatas: () => Promise<any>;
    getMetadata: (modelName: any) => Promise<any>;
}, "error" | "loading">, Pick<{
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<any, any>;
    fetchMetadatas: () => Promise<void>;
    getMetadatas: () => Promise<any>;
    getMetadata: (modelName: any) => Promise<any>;
}, never>, Pick<{
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<any, any>;
    fetchMetadatas: () => Promise<void>;
    getMetadatas: () => Promise<any>;
    getMetadata: (modelName: any) => Promise<any>;
}, "fetchMetadatas" | "getMetadatas" | "getMetadata">>;
//# sourceMappingURL=metadata.d.ts.map