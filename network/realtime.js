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
 * How long the echo of a write is waited for. Keyed by its own request, an
 * expectation can match no other frame: this only bounds what is kept.
 *
 * @type {Number}
 */
const EXPECTATION_TTL = 30000;

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
 * `origin` the client instance behind it, and `data` what the server announced
 * with the id: the columns the model declared to carry, so a view can tell
 * whether the write is any of its business. A write of this tab carries none.
 * `announced` says the socket heard it, rather than the API layer.
 *
 * @param {{model: String, id: (String|Number|null), action: String,
 *          changed?: String[]|null, origin?: String|null,
 *          truncated?: Boolean, data?: Object<String, *>|null,
 *          announced?: Boolean}} event
 */
export function notifyChanged(event) {
    bus.trigger(RESOURCE_CHANGED, {
        data: null,
        changed: null,
        origin: null,
        truncated: false,
        announced: false,
        ...event,
    });
}

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
export class RealtimeSocket {
    constructor() {
        this.socket = null;
        this.token = null;
        this.scope = null;
        this.authenticated = false;
        this.wanted = false;
        this.announced = null;
        this.channels = new Map();
        this.expected = new Map();
        this.everConnected = false;
        this.retryDelay = RECONNECT_START;
        this.retryTimer = null;
        this.heartbeatTimer = null;
    }

    /**
     * Open the socket, or point the open one at another scope.
     *
     * @param {String}      token
     * @param {String|null} [scope]
     */
    connect(token, scope = null) {
        this.wanted = true;
        this.scope = scope ?? null;

        if (this.socket && this.token === token) {
            this.watch(this.scope);

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
     * Say what this tab is reading, so it hears that and nothing else.
     *
     * `announced` is what the server already knows, so the same scope said
     * twice, by the caller and by the catch-up on authentication, is one frame.
     *
     * @param {String|null} scope
     */
    watch(scope) {
        this.scope = scope ?? null;

        if (this.authenticated && this.scope !== this.announced) {
            this.announced = this.scope;
            this.send('watch', { scope: this.scope });

            // A socket leaving a scope loses there what it subscribed to, and
            // one that opened before its scope was known subscribed to
            // nothing. Either way the channels the views hold are said again.
            if (this.channels.size) {
                this.send('subscribe', { channels: [...this.channels.keys()] });
            }
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

    /**
     * Expect the echo of a write about to leave, under the origin its request carries.
     *
     * The frame answering it is dropped, once: the api layer announces that change
     * when the request answers. What else the request made the server announce, a
     * signal writing another record, is heard.
     *
     * @param {String}             origin - The request origin, from `requestOrigin()`
     * @param {String}             model
     * @param {String|Number|null} [id]   - None for a create, whose id is not known yet
     */
    expect(origin, model, id = null) {
        const now = Date.now();

        for (const [key, expected] of this.expected) {
            if (now - expected.at > EXPECTATION_TTL) {
                this.expected.delete(key);
            }
        }

        this.expected.set(origin, { model, id: id ?? null, at: now });
    }

    /**
     * Whether a record frame is an expected echo, spending the expectation if so.
     *
     * @param {String|null|undefined} origin
     * @param {String}                model
     * @param {String|Number|null}    id
     *
     * @returns {Boolean}
     */
    answered(origin, model, id) {
        const expected = origin ? this.expected.get(origin) : undefined;

        if (!expected || expected.model !== model || Date.now() - expected.at > EXPECTATION_TTL) {
            return false;
        }

        if (expected.id !== null && (id === null || String(expected.id) !== String(id))) {
            return false;
        }

        this.expected.delete(origin);

        return true;
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
            // scope changed while it was in flight is caught up on, and so the
            // same one is never said twice.
            this.announced = this.scope;

            socket.send(
                JSON.stringify({
                    type: 'authenticate',
                    data: { token: this.token, scope: this.announced },
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

            // The scope changed while the handshake was in flight: what the
            // server was told is out of date.
            this.watch(this.scope);

            // A new socket was told nothing, and the server drops what a socket
            // subscribed to when it leaves a scope.
            if (this.channels.size) {
                this.send('subscribe', { channels: [...this.channels.keys()] });
            }

            return;
        }

        if (message.type === 'auth_error') {
            // A refusal does not fix itself: stop here until something says to
            // connect again, which `useRealtime` does when the account or its
            // token changes, and by refreshing a token the server refused.
            this.wanted = false;
            bus.trigger('realtime:refused', { message: message.data?.message ?? null });

            return;
        }

        const data = message.data ?? null;
        const [model, action] = String(message.type).split('.');
        const isRecord = Boolean(model) && RESOURCE_ACTIONS.includes(action);
        const id = data?.id ?? null;

        // The echo of a write this tab announced when its request answered: the
        // same fact twice. That frame alone stops here, not every frame of the
        // request, whose signals may have written other records.
        if (isRecord && this.answered(message.origin, model, id)) {
            return;
        }

        const meta = {
            changed: message.changed ?? null,
            origin: ownOrigin(message.origin),
            truncated: !!message.truncated,
        };

        if (isRecord) {
            notifyChanged({ model, id, action, data, ...meta, announced: true });

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
 * The origin a view compares with `originId`: every request of this tab is this tab.
 *
 * @param {String|null|undefined} origin
 *
 * @returns {String|null}
 */
function ownOrigin(origin) {
    if (!origin) {
        return null;
    }

    return origin === originId || origin.startsWith(`${originId}.`) ? originId : origin;
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
