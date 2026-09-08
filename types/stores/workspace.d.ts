/**
 * Name the columns the workspace list carries, for an application that shows
 * more than a name.
 */
export function setWorkspaceFields(fields: any): void;
/**
 * The workspace the user last chose, before anything is loaded.
 *
 * Read by a router that has to name one in a redirect target, which happens
 * before the store had a chance to answer.
 */
export function storedWorkspaceSlug(): string;
export const useWorkspaceStore: import("pinia").SetupStoreDefinition<"workspace", {
    workspaces: import("vue").Ref<any[], any[]>;
    current: import("vue").Ref<any, any>;
    slug: import("vue").ComputedRef<any>;
    loading: import("vue").Ref<boolean, boolean>;
    load: () => Promise<any>;
    refresh: () => Promise<any>;
    create: (payload: any) => Promise<any>;
    remove: (value: any) => Promise<any>;
    select: (value: any) => void;
}>;
//# sourceMappingURL=workspace.d.ts.map