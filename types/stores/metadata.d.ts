export const useMetadataStore: import("pinia").StoreDefinition<"metadata", Pick<{
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<any, any>;
    prefix: import("vue").Ref<any, any>;
    setPrefix: (newPrefix: any) => void;
    getPrefix: () => any;
    fetchMetadatas: () => Promise<void>;
    getMetadatas: () => Promise<any>;
    getMetadata: (modelName: any) => Promise<any>;
}, "error" | "loading" | "prefix">, Pick<{
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<any, any>;
    prefix: import("vue").Ref<any, any>;
    setPrefix: (newPrefix: any) => void;
    getPrefix: () => any;
    fetchMetadatas: () => Promise<void>;
    getMetadatas: () => Promise<any>;
    getMetadata: (modelName: any) => Promise<any>;
}, never>, Pick<{
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<any, any>;
    prefix: import("vue").Ref<any, any>;
    setPrefix: (newPrefix: any) => void;
    getPrefix: () => any;
    fetchMetadatas: () => Promise<void>;
    getMetadatas: () => Promise<any>;
    getMetadata: (modelName: any) => Promise<any>;
}, "setPrefix" | "getPrefix" | "fetchMetadatas" | "getMetadatas" | "getMetadata">>;
//# sourceMappingURL=metadata.d.ts.map