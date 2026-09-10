/**
 * The one event every holder listens to, whatever moved the record.
 *
 * A write made here fires it as soon as the request answers, and a write made
 * anywhere else fires it when the server announces it. One vocabulary for one
 * fact, so a view says once what it reads instead of wiring a refresh for its
 * own mutations and another for everyone else's.
 *
 * @type {String}
 */
export declare const RESOURCE_CHANGED: string;
/**
 * The actions a record announcement can carry.
 *
 * What the server names a write. Anything else the server says, under whatever
 * name it chose, is its own event and travels on the bus under that name.
 *
 * @type {String[]}
 */
export declare const RESOURCE_ACTIONS: string[];
/**
 * Say a record moved, to whatever is holding it.
 *
 * Called by the API layer on its own writes and by the socket on the server's
 * announcements. `changed` names the columns the write moved, when it is known,
 * and `origin` the client instance behind it.
 *
 * @param {{model: String, id: (String|Number|null), action: String,
 *          changed?: String[]|null, origin?: String|null,
 *          truncated?: Boolean}} event
 */
export declare function notifyChanged(event: {
    model: string;
    id: (string | number | null);
    action: string;
    changed?: string[] | null;
    origin?: string | null;
    truncated?: boolean;
}): void;
/**
 * The live events of what this tab reads, as the server sees them.
 *
 * One socket per tab, authenticated by its first frame because a browser cannot
 * put a header on a WebSocket handshake. Everything the server announces is
 * dispatched on the shared bus under its own name (`product.written`,
 * `order.deleted`, …), so a view listens with `useBus` like it does for
 * anything else.
 *
 * Events carry identifiers, never content. One marked `truncated` is the server
 * saying it left the payload behind: read it back through the API.
 */
export declare class RealtimeSocket {
    socket: WebSocket | null;
    token: string | null;
    scope: string | null;
    authenticated: boolean;
    wanted: boolean;
    announced: any;
    channels: Map<any, any>;
    everConnected: boolean;
    retryDelay: number;
    retryTimer: number | null;
    heartbeatTimer: number | null;
    constructor();
    /**
     * Open the socket, or point the open one at another scope.
     *
     * @param {String}      token
     * @param {String|null} [scope]
     */
    connect(token: string, scope?: string | null): void;
    /**
     * Close for good, and forget what was asked for.
     *
     * Subscriptions belong to the views that asked for them, and a deliberate
     * disconnect means those views are going away. What survives a socket that
     * dropped on its own is the whole point of `close()` not doing this.
     */
    disconnect(): void;
    /**
     * Say what this tab is reading, so it hears that and nothing else.
     *
     * `announced` is what the server already knows, so the same scope said
     * twice, by the caller and by the catch-up on authentication, is one frame.
     *
     * @param {String|null} scope
     */
    watch(scope: string | null): void;
    /**
     * Ask to hear about a model, or about one of its records.
     *
     * `subscribe('product')` is what a list watches so it can refresh;
     * `subscribe('product', 42)` is what the page reading that product watches.
     * Subscriptions are counted, so two views watching the same channel are one
     * subscription that survives either of them leaving, and they are said
     * again on a new socket, which knows nothing of what the old one was told.
     *
     * @param {String}             model
     * @param {String|Number|null} [id]
     *
     * @returns {String} The channel that was subscribed to
     */
    subscribe(model: string, id?: string | number | null): string;
    /**
     * Let go of one hold on a channel, and leave it when it was the last.
     *
     * @param {String}             model
     * @param {String|Number|null} [id]
     */
    unsubscribe(model: string, id?: string | number | null): void;
    startHeartbeat(): void;
    stopHeartbeat(): void;
    /**
     * @param {String} type
     * @param {Object} [data]
     */
    send(type: string, data?: any): void;
    open(): void;
    close(): void;
    /**
     * @param {MessageEvent} event
     */
    receive(event: MessageEvent): void;
    scheduleReconnect(): void;
}
/**
 * `product` for a list, `product:42` for one record.
 *
 * @param {String}             model
 * @param {String|Number|null} id
 *
 * @returns {String}
 */
export declare function channelOf(model: string, id: string | number | null): string;
/**
 * The one socket of this tab.
 *
 * @type {RealtimeSocket}
 */
export declare const realtime: RealtimeSocket;
//# sourceMappingURL=realtime.d.ts.map