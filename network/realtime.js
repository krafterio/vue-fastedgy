/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { bus } from '../composables/bus.js';
import { absoluteUrl } from '../plugins/fetcher.js';
import { originId } from '../utils/origin.js';

/**
 * Relative to the API base, which already carries its own prefix.
 *
 * @type {String}
 */
const PATH = '/ws';

/**
 * A closed socket is reopened, later each time, up to the cap: a tab left open
 * through a deploy, or a laptop coming out of sleep, finds its way back without
 * hammering the server on the way.
 *
 * @type {Number}
 */
const RECONNECT_START = 1000;

/**
 * How often the socket says it is still there. An idle connection is dropped by
 * whatever sits between the browser and the server.
 */
const HEARTBEAT_INTERVAL = 30000;

/**
 * @type {Number}
 */
const RECONNECT_MAX = 30000;

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
export const RESOURCE_CHANGED = 'resource:changed';

/**
 * The actions a record announcement can carry.
 *
 * What the server names a write. Anything else the server says, under whatever
 * name it chose, is its own event and travels on the bus under that name.
 *
 * @type {String[]}
 */
export const RESOURCE_ACTIONS = ['created', 'updated', 'deleted'];

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
export function notifyChanged(event) {
    bus.trigger(RESOURCE_CHANGED, {
        changed: null,
        origin: null,
        truncated: false,
        ...event,
    });
}

/**
 * The workspace's live events, as the server sees them.
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
export class RealtimeSocket {
    constructor() {
        this.socket = null;
        this.token = null;
        this.workspace = null;
        this.authenticated = false;
        this.wanted = false;
        this.announced = null;
        this.channels = new Map();
        this.everConnected = false;
        this.retryDelay = RECONNECT_START;
        this.retryTimer = null;
        this.heartbeatTimer = null;
    }

    /**
     * Open the socket, or point the open one at another workspace.
     *
     * @param {String}      token
     * @param {String|null} [workspace]
     */
    connect(token, workspace = null) {
        this.wanted = true;
        this.workspace = workspace ?? null;

        if (this.socket && this.token === token) {
            this.watch(this.workspace);

            return;
        }

        // Another account, or the same one with a new token: the open socket
        // answers for the old one and has to go.
        if (this.socket) {
            this.close();
        }

        this.token = token;
        this.open();
    }

    /**
     * Close for good, and forget what was asked for.
     *
     * Subscriptions belong to the views that asked for them, and a deliberate
     * disconnect means those views are going away. What survives a socket that
     * dropped on its own is the whole point of `close()` not doing this.
     */
    disconnect() {
        this.wanted = false;
        this.everConnected = false;
        this.channels.clear();
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
        this.close();
    }

    /**
     * Say which workspace this tab is reading, so it hears that one only.
     *
     * `announced` is what the server already knows, so the same workspace said
     * twice, by the caller and by the catch-up on authentication, is one frame.
     *
     * @param {String|null} workspace
     */
    watch(workspace) {
        this.workspace = workspace ?? null;

        if (this.authenticated && this.workspace !== this.announced) {
            this.announced = this.workspace;
            this.send('watch', { workspace: this.workspace });
        }
    }

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
    subscribe(model, id = null) {
        const channel = channelOf(model, id);
        const held = this.channels.get(channel) ?? 0;

        this.channels.set(channel, held + 1);

        if (held === 0) {
            this.send('subscribe', { channels: [channel] });
        }

        return channel;
    }

    /**
     * Let go of one hold on a channel, and leave it when it was the last.
     *
     * @param {String}             model
     * @param {String|Number|null} [id]
     */
    unsubscribe(model, id = null) {
        const channel = channelOf(model, id);
        const held = this.channels.get(channel) ?? 0;

        if (held === 0) {
            return;
        }

        if (held > 1) {
            this.channels.set(channel, held - 1);

            return;
        }

        this.channels.delete(channel);
        this.send('unsubscribe', { channels: [channel] });
    }

    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => this.send('heartbeat', null), HEARTBEAT_INTERVAL);
    }

    stopHeartbeat() {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
    }

    /**
     * @param {String} type
     * @param {Object} [data]
     */
    send(type, data = {}) {
        if (this.socket && this.socket.readyState === 1) {
            this.socket.send(JSON.stringify({ type, data }));
        }
    }

    open() {
        if (!this.token) {
            return;
        }

        const socket = new WebSocket(socketUrl());

        this.socket = socket;
        this.authenticated = false;

        socket.onopen = () => {
            // What the handshake tells the server it is reading. Kept so a
            // workspace changed while it was in flight is caught up on, and so
            // the same one is never said twice.
            this.announced = this.workspace;

            socket.send(
                JSON.stringify({
                    type: 'authenticate',
                    data: { token: this.token, workspace: this.announced },
                })
            );
        };

        socket.onmessage = (event) => this.receive(event);

        socket.onclose = () => {
            if (this.socket === socket) {
                this.socket = null;
                this.authenticated = false;
                this.scheduleReconnect();
            }
        };
    }

    close() {
        this.authenticated = false;
        this.stopHeartbeat();
        // A new socket knows nothing of what the old one was told.
        this.announced = null;

        if (this.socket) {
            const socket = this.socket;

            this.socket = null;
            socket.close();
        }
    }

    /**
     * @param {MessageEvent} event
     */
    receive(event) {
        let message;

        try {
            message = JSON.parse(event.data);
        } catch {
            return;
        }

        if (message.type === 'auth_success') {
            this.authenticated = true;
            this.retryDelay = RECONNECT_START;

            this.startHeartbeat();

            // The socket answers again, whether for the first time or not: what
            // a view has to say for itself on a fresh connection is said here.
            bus.trigger('realtime:connected', { reconnected: this.everConnected });

            // Nothing is replayed: whatever happened while the socket was down
            // was said to nobody. A view that updates itself has to read again
            // rather than keep showing what it held.
            if (this.everConnected) {
                bus.trigger('realtime:reconnected', {});
            }

            this.everConnected = true;

            // The workspace changed while the handshake was in flight: what the
            // server was told is out of date.
            this.watch(this.workspace);

            // A new socket was told nothing, and the server drops what a socket
            // subscribed to when it leaves a workspace.
            if (this.channels.size) {
                this.send('subscribe', { channels: [...this.channels.keys()] });
            }

            return;
        }

        if (message.type === 'auth_error') {
            // A refused token does not fix itself: stop here until something
            // says to connect again, which `useRealtime` does when the account
            // changes.
            this.wanted = false;

            return;
        }

        // A write this instance made already said so, the moment the request
        // answered. Its announcement coming back is the same fact twice, so it
        // stops here. Only a record announcement carries an origin, so anything
        // an application broadcasts for itself is never dropped.
        if (message.origin && message.origin === originId) {
            return;
        }

        const data = message.data ?? null;
        const meta = {
            changed: message.changed ?? null,
            origin: message.origin ?? null,
            truncated: !!message.truncated,
        };
        const [model, action] = String(message.type).split('.');

        if (model && RESOURCE_ACTIONS.includes(action)) {
            notifyChanged({ model, id: data?.id ?? null, action, ...meta });

            return;
        }

        // Whatever else the server announces for itself, under its own name.
        bus.trigger(message.type, { data, ...meta });
    }

    scheduleReconnect() {
        if (!this.wanted || this.retryTimer) {
            return;
        }

        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;

            if (this.wanted) {
                this.open();
            }
        }, this.retryDelay);

        this.retryDelay = Math.min(this.retryDelay * 2, RECONNECT_MAX);
    }
}

/**
 * `product` for a list, `product:42` for one record.
 *
 * @param {String}             model
 * @param {String|Number|null} id
 *
 * @returns {String}
 */
export function channelOf(model, id) {
    return id === null || id === undefined ? model : `${model}:${String(id)}`;
}

/**
 * The socket URL, on the API base, over the WebSocket scheme.
 *
 * @returns {String}
 */
function socketUrl() {
    const parsed = new URL(absoluteUrl(PATH) ?? PATH, window.location.origin);

    parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';

    return parsed.toString();
}

/**
 * The one socket of this tab.
 *
 * @type {RealtimeSocket}
 */
export const realtime = new RealtimeSocket();
