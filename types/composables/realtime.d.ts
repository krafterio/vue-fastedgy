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
export declare function useRealtime(workspace: (Function)): void;
/**
 * Hear one of the events the server announces for itself, while a view is on screen.
 *
 * Those are the announcements that belong to no model: a job that finished, a
 * message that arrived, whatever an application broadcasts under its own name.
 * The handler is called with the payload the server sent, and nothing else.
 *
 * @param {String}                 type    - Name the server announces it under
 * @param {function(any): void}    handler
 *
 * @example
 * useRealtimeEvent('aliment_image_generated', ({ label }) => toast.success(label));
 */
export declare function useRealtimeEvent(type: string, handler: Function): void;
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
export declare function useResourceChanged(model: string, handler: Function, options?: {
    id?: string | number | null | (Function);
    (): (string | number | null);
}): Function;
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
export declare function touches(event: {
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
 * @param {{fields?: String|String[], params?: object, immediate?: Boolean,
 *          api?: Object}}                                                     [options]
 *
 * @returns {{data: import("vue").Ref, status: import("vue").Ref<String>,
 *           error: import("vue").Ref, isDeleted: import("vue").Ref<Boolean>,
 *           refresh: function(): Promise<void>}}
 *
 * @example
 * const { data: company, status, isDeleted } = useApiRecord('company', () => route.params.id);
 */
export declare function useApiRecord(model: string, id: string | number | (Function), options?: {
    fields?: string | string[];
    params?: object;
    immediate?: boolean;
    api?: any;
}): {
    data: import("vue").Ref;
    status: import("vue").Ref<string>;
    error: import("vue").Ref;
    isDeleted: import("vue").Ref<boolean>;
    refresh: Function;
    (): Promise<void>;
};
/**
 * Hold a list, and keep it in step with what happens to its model.
 *
 * A burst of writes is collapsed before the rows re-read, a field saved on a
 * timer firing one event per tick. A delete drops its row without going back to
 * the server, and an update that moved nothing the list reads is left alone.
 *
 * @param {String}                                                       model
 * @param {object|(function(): object)|import("vue").Ref<object>}        [query]
 * @param {{params?: object, immediate?: Boolean, refreshDelay?: Number,
 *          watchFields?: String[]|null, api?: object}}                  [options]
 *
 * @returns {{items: import("vue").Ref<Array>, total: import("vue").Ref<Number>,
 *           status: import("vue").Ref<String>, error: import("vue").Ref,
 *           refresh: function(): Promise<void>}}
 *
 * @example
 * const { items, total, status } = useApiCollection('company', () => ({ fields: 'id,name', limit: 25 }));
 */
export declare function useApiCollection(model: string, query?: object | (Function), options?: {
    params?: object;
    immediate?: boolean;
    refreshDelay?: number;
    watchFields?: string[] | null;
    api?: object;
}): {
    items: import("vue").Ref<any[]>;
    total: import("vue").Ref<number>;
    status: import("vue").Ref<string>;
    error: import("vue").Ref;
    refresh: Function;
    (): Promise<void>;
};
//# sourceMappingURL=realtime.d.ts.map