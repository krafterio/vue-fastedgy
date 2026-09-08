/**
 * Keep the live socket in step with who is signed in and what they are reading.
 *
 * Called once, from the application shell. The workspace comes from the
 * workspace store, which the router keeps on the one in the URL; an application
 * that names it another way passes its own source.
 *
 * A page with no workspace (an onboarding, an auth screen) has nothing to
 * listen to: the socket waits rather than opening on nothing.
 *
 * @param {(function(): (String|null))|import("vue").Ref<String|null>} [workspace]
 *
 * @example
 * // In the application shell
 * import { useRealtime } from 'vue-fastedgy';
 *
 * useRealtime();
 *
 * @example
 * // An application that reads the workspace off the route itself
 * useRealtime(() => useRoute().params.workspace ?? null);
 */
export function useRealtime(workspace?: (() => (string | null)) | import("vue").Ref<string | null>): void;
/**
 * Hear about a model, or about one record of it, while a view is on screen.
 *
 * The one stream: a write made here and a write made by anyone else say the
 * same thing, once. The handler is called with `{model, id, action, changed,
 * origin, truncated}`, and events carry identifiers only, so read the record
 * back through the API.
 *
 * It is also called with `action: 'reconnected'` and no id when the socket
 * comes back, because nothing is replayed: what happened while it was down was
 * said to nobody, and the view has to read again to stop showing a stale
 * screen. That one is never held back.
 *
 * @param {String}                                                          model
 * @param {function({model: String, id: (String|Number|null), action: String,
 *                   changed: (String[]|null), origin: (String|null),
 *                   truncated: Boolean}): void}                            handler
 * @param {{id?: String|Number|null|(function(): (String|Number|null))|
 *              import("vue").Ref<String|Number|null>,
 *          watchFields?: String[]|null, refreshDelay?: Number}}            [options]
 *
 * @returns {function(): void} Stop listening
 *
 * @example
 * // A list that refreshes on any write of the model
 * useResourceChanged('company', () => reload());
 *
 * // A page that follows the record it reads, id and all
 * useResourceChanged('company', () => reload(), { id: () => route.params.id });
 *
 * // A list that only cares about the columns it shows
 * useResourceChanged('company', () => reload(), { watchFields: ['name', 'domain'] });
 */
export function useResourceChanged(model: string, handler: (arg0: {
    model: string;
    id: (string | number | null);
    action: string;
    changed: (string[] | null);
    origin: (string | null);
    truncated: boolean;
}) => void, options?: {
    id?: string | number | null | (() => (string | number | null)) | import("vue").Ref<string | number | null>;
    watchFields?: string[] | null;
    refreshDelay?: number;
}): () => void;
/**
 * Whether something reading [read] has anything to learn from a change.
 *
 * Anything but an update always has: a row appearing or going changes a list
 * whatever its columns are. An update that did not say what it moved has too,
 * an event that says nothing meaning everything. And reading nothing in
 * particular is reading everything: a holder that has not said what it is after
 * cannot be told it is not concerned.
 *
 * A dotted path counts either way round, `company` moving being news to a
 * holder reading `company.name`.
 *
 * @param {{action: String, changed?: String[]|null}} event
 * @param {String[]}                                  read
 *
 * @returns {Boolean}
 */
export function touches(event: {
    action: string;
    changed?: string[] | null;
}, read: string[]): boolean;
/**
 * Hold one record, and keep it in step with what happens to it.
 *
 * It re-reads itself silently when the record is updated anywhere, and flips
 * `isDeleted` when it goes, so a detail screen can close itself. `id` may be a
 * getter or a ref, and the holder follows it.
 *
 * @param {String}                                                             model
 * @param {String|Number|(function(): (String|Number|null))|
 *         import("vue").Ref<String|Number|null>}                              id
 * @param {{fields?: String|String[], params?: Object, immediate?: Boolean,
 *          api?: Object}}                                                     [options]
 *
 * @returns {{data: import("vue").Ref, status: import("vue").Ref<String>,
 *           error: import("vue").Ref, isDeleted: import("vue").Ref<Boolean>,
 *           refresh: function(): Promise<void>}}
 *
 * @example
 * const { data: company, status, isDeleted } = useApiRecord('company', () => route.params.id);
 */
export function useApiRecord(model: string, id: string | number | (() => (string | number | null)) | import("vue").Ref<string | number | null>, options?: {
    fields?: string | string[];
    params?: any;
    immediate?: boolean;
    api?: any;
}): {
    data: import("vue").Ref;
    status: import("vue").Ref<string>;
    error: import("vue").Ref;
    isDeleted: import("vue").Ref<boolean>;
    refresh: () => Promise<void>;
};
/**
 * Hold a list, and keep it in step with what happens to its model.
 *
 * A burst of writes is collapsed before the rows re-read, a field saved on a
 * timer firing one event per tick. A delete drops its row without going back to
 * the server, and an update that moved nothing the list reads is left alone.
 *
 * @param {String}                                                       model
 * @param {Object|(function(): Object)|import("vue").Ref<Object>}        [query]
 * @param {{params?: Object, immediate?: Boolean, refreshDelay?: Number,
 *          watchFields?: String[]|null, api?: Object}}                  [options]
 *
 * @returns {{items: import("vue").Ref<Array>, total: import("vue").Ref<Number>,
 *           status: import("vue").Ref<String>, error: import("vue").Ref,
 *           refresh: function(): Promise<void>}}
 *
 * @example
 * const { items, total, status } = useApiCollection('company', () => ({ fields: 'id,name', limit: 25 }));
 */
export function useApiCollection(model: string, query?: any | (() => any) | import("vue").Ref<any>, options?: {
    params?: any;
    immediate?: boolean;
    refreshDelay?: number;
    watchFields?: string[] | null;
    api?: any;
}): {
    items: import("vue").Ref<any[]>;
    total: import("vue").Ref<number>;
    status: import("vue").Ref<string>;
    error: import("vue").Ref;
    refresh: () => Promise<void>;
};
//# sourceMappingURL=realtime.d.ts.map