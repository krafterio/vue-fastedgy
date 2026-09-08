/**
 * Name the columns the workspace list carries, for an application that shows
 * more than a name.
 */
export declare function setWorkspaceFields(fields: any): void;
/**
 * The workspace the user last chose, before anything is loaded.
 *
 * Read by a router that has to name one in a redirect target, which happens
 * before the store had a chance to answer.
 */
export declare function storedWorkspaceSlug(): string | null;
export declare const useWorkspaceStore: import("pinia").SetupStoreDefinition<"workspace", {
    workspaces: import("vue").Ref<never[], never[]>;
    current: import("vue").Ref<null, null>;
    slug: import("vue").ComputedRef<any>;
    loading: import("vue").Ref<boolean, boolean>;
    load: () => Promise<null>;
    refresh: () => Promise<null>;
    create: (payload: any) => Promise<any>;
    remove: (value: any) => Promise<any>;
    select: (value: any) => void;
}>;
//# sourceMappingURL=workspace.d.ts.map