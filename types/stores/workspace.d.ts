/**
 * The current workspace left the list read again: the account was removed from
 * it, or it was deleted. Triggered with that workspace. The one the account
 * leaves itself ([leave]) is not announced.
 *
 * @type {String}
 */
export declare const WORKSPACE_LOST: string;
/**
 * Whatever reads the current workspace off the URL has to read it again: the
 * one it names was refused by the server, lost or renamed.
 * [useWorkspaceRouterGuard] hears it.
 *
 * @type {String}
 */
export declare const WORKSPACE_REROUTE: string;
/**
 * Name the columns the workspace list carries, for an application that shows
 * more than a name.
 */
export declare function setWorkspaceFields(fields: any): void;
/**
 * The workspace last opened on this device, before anything is loaded; null
 * when the application keeps no such memory.
 *
 * Read by a router that has to name one in a redirect target, which happens
 * before the store had a chance to answer.
 */
export declare function storedWorkspaceSlug(): string | null;
/**
 * The account's workspaces and the current one, the tenant `/{workspace}`
 * stands for: chosen, followed and changed the way flutter_fastedgy's
 * `WorkspaceProvider` does, case for case (the corpus `workspaces.json` both
 * packages run).
 *
 * The choice, always after the account (`/me`): the slug of the URL as it is;
 * without one, or once the server refused it, the last workspace opened on
 * this device, then the account's default, then the first of the list.
 */
export declare const useWorkspaceStore: import("pinia").SetupStoreDefinition<"workspace", {
    workspaces: import("vue").Ref<never[], never[]>;
    current: import("vue").WritableComputedRef<null, null>;
    slug: import("vue").Ref<null, null>;
    loading: import("vue").Ref<boolean, boolean>;
    loaded: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<null, null>;
    load: () => Promise<any>;
    retry: () => Promise<any>;
    refresh: () => Promise<any>;
    refreshAfterError: () => Promise<any>;
    ensureCurrent: () => Promise<string | null>;
    resolve: (value?: string | null) => Promise<'stay' | 'empty' | 'failed' | {
        redirect: string;
    }>;
    select: (value: any) => void;
    selectSlug: (value: any) => Promise<boolean>;
    adopt: (workspace: any) => void;
    create: (payload: any) => Promise<any>;
    remove: (value: any) => Promise<Record<string, any> | null>;
    leave: (request: Function) => Promise<Record<string, any> | null>;
    makeDefault: (value: any) => Promise<void>;
    renamedSlug: (value: any) => string | null;
    isRefused: (value: any) => boolean;
    bySlug: (value: any) => null;
    byId: (id: any) => null;
    concernsCurrent: (change: any) => boolean;
}>;
/**
 * Serve one workspace at a time: the workspaces augment the fetcher and the
 * metadatas, which know nothing of them.
 *
 * - A request under `/{workspace}/` waits for the choice of the current
 *   workspace and goes under its slug; without one, under `workspaceless`
 *   (`global`), or it is refused when that is `null`. One answering 404 has the
 *   list read again: the workspace may be gone.
 * - The metadatas are held by workspace ([setMetadataScope]).
 *
 *
 * @param {{rememberLast?: Boolean, workspaceless?: String|null, fields?: String}} [options]
 *   `rememberLast`: the last workspace opened on this device is the one opened
 *   next (`true`); `fields`: the columns the list carries
 * @returns {function(): void} Stop serving them
 */
export declare function useWorkspaces(options?: {
    rememberLast?: boolean;
    workspaceless?: string | null;
    fields?: string;
}): Function;
/**
 * [useWorkspaces] as a plugin.
 *
 * @param {{rememberLast?: Boolean, workspaceless?: String|null, fields?: String}} [options]
 *
 * @example
 * app.use(createFetcher({ surface: 'app' }));
 * app.use(createWorkspaces({ workspaceless: null }));
 */
export declare function createWorkspaces(options?: {
    rememberLast?: boolean;
    workspaceless?: string | null;
    fields?: string;
}): {
    install(app: any): void;
};
/**
 * Keep the URL and the current workspace in step: a route carrying the
 * workspace (`:workspace`) is resolved on each navigation, and so is a route
 * asking for the choice (`meta.workspace: true`, the root). The decision is the
 * store's ([useWorkspaceStore.resolve]), the same as flutter_fastedgy's.
 *
 * A workspace refused, lost or renamed while its URL is shown leads the router
 * to resolve the current route again.
 *
 * @param {import('vue-router').Router} router
 * @param {{param?: String,
 *          home: function(String): import('vue-router').RouteLocationRaw,
 *          empty?: import('vue-router').RouteLocationRaw,
 *          failed?: import('vue-router').RouteLocationRaw}} options
 *   `home` is where a slug leads from a route that carries none; `empty` where
 *   an account without a workspace goes (`/` by default); `failed` where it goes
 *   when its list cannot be read (`empty` by default)
 */
export declare function useWorkspaceRouterGuard(router: import('vue-router').Router, { param, home, empty, failed }?: {
    param?: string;
    home: Function;
    (String: any): import('vue-router').RouteLocationRaw;
    empty?: import('vue-router').RouteLocationRaw;
    failed?: import('vue-router').RouteLocationRaw;
}): void;
//# sourceMappingURL=workspace.d.ts.map