/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bus } from '../composables/bus.js';
import { realtime, RESOURCE_CHANGED } from '../network/realtime.js';
import { originId } from '../utils/origin.js';

const sockets = [];

class FakeWebSocket {
    constructor(url) {
        this.url = url;
        this.readyState = 1;
        this.sent = [];
        this.closed = false;
        sockets.push(this);
    }

    send(payload) {
        this.sent.push(JSON.parse(payload));
    }

    close() {
        this.closed = true;
        this.onclose?.();
    }

    receive(message) {
        this.onmessage?.({ data: JSON.stringify(message) });
    }
}

const lastSocket = () => sockets[sockets.length - 1];

function connect(token = 'a-token', scope = 'krafter') {
    realtime.connect(token, scope);
    lastSocket().onopen();

    return lastSocket();
}

describe('realtime socket', () => {
    beforeEach(() => {
        realtime.disconnect();
        sockets.length = 0;
        vi.stubGlobal('WebSocket', FakeWebSocket);
    });

    it('authenticates itself with the first frame it sends', () => {
        const socket = connect();

        expect(socket.sent).toEqual([{ type: 'authenticate', data: { token: 'a-token', scope: 'krafter' } }]);
    });

    it('opens against the api path, over the websocket scheme', () => {
        expect(connect().url).toMatch(/^ws:\/\/[^/]+\/api\/ws$/);
    });

    it('dispatches what the server announces on the shared bus', () => {
        const socket = connect();
        const heard = [];

        bus.addEventListener('fragment.written', (event) => heard.push(event.detail));
        socket.receive({ type: 'auth_success', data: {} });
        socket.receive({ type: 'fragment.written', data: { fragment_id: 3 } });

        expect(heard).toEqual([{ data: { fragment_id: 3 }, changed: null, origin: null, truncated: false }]);
    });

    it('passes on the server saying it left the payload behind', () => {
        const socket = connect();
        const heard = [];

        bus.addEventListener('engram.written', (event) => heard.push(event.detail));
        socket.receive({ type: 'auth_success', data: {} });
        socket.receive({ type: 'engram.written', data: null, truncated: true });

        expect(heard).toEqual([{ data: null, changed: null, origin: null, truncated: true }]);
    });

    it('carries a server announcement onto the unified stream', () => {
        const socket = connect();
        const heard = [];

        bus.addEventListener(RESOURCE_CHANGED, (event) => heard.push(event.detail));
        socket.receive({ type: 'auth_success', data: {} });
        socket.receive({ type: 'company.updated', data: { id: 7 }, changed: ['name'], origin: 'another-tab' });

        expect(heard).toEqual([
            { model: 'company', id: 7, action: 'updated', changed: ['name'], origin: 'another-tab', truncated: false },
        ]);
    });

    it('leaves its own echo alone on the unified stream', () => {
        const socket = connect();
        const heard = [];

        bus.addEventListener(RESOURCE_CHANGED, (event) => heard.push(event.detail));
        socket.receive({ type: 'auth_success', data: {} });
        socket.receive({ type: 'company.updated', data: { id: 7 }, origin: originId });

        expect(heard).toEqual([]);
    });

    it('never drops what the server announces for itself', () => {
        const socket = connect();
        const heard = [];

        bus.addEventListener('import.finished', (event) => heard.push(event.detail));
        socket.receive({ type: 'auth_success', data: {} });
        socket.receive({ type: 'import.finished', data: { rows: 12 } });

        expect(heard).toEqual([{ data: { rows: 12 }, changed: null, origin: null, truncated: false }]);
    });

    it('tells the server when the tab reads another scope', () => {
        const socket = connect();

        socket.receive({ type: 'auth_success', data: {} });
        realtime.watch('studio-nord');

        expect(socket.sent.at(-1)).toEqual({ type: 'watch', data: { scope: 'studio-nord' } });
    });

    it('catches up when the scope changed while it was authenticating', () => {
        const socket = connect('a-token', 'krafter');

        realtime.watch('studio-nord');
        socket.receive({ type: 'auth_success', data: {} });

        expect(socket.sent.at(-1)).toEqual({ type: 'watch', data: { scope: 'studio-nord' } });
    });

    it('says its channels again to the scope it moves to', () => {
        const socket = connect('a-token', null);

        socket.receive({ type: 'auth_success', data: {} });
        realtime.subscribe('engram');
        realtime.subscribe('engram', 42);
        realtime.watch('studio-nord');

        expect(socket.sent.at(-1)).toEqual({ type: 'subscribe', data: { channels: ['engram', 'engram:42'] } });
    });

    it('says a scope once, however many times it is asked to', () => {
        const socket = connect('a-token', 'krafter');

        socket.receive({ type: 'auth_success', data: {} });
        realtime.watch('studio-nord');
        realtime.watch('studio-nord');
        realtime.connect('a-token', 'studio-nord');

        const watches = socket.sent.filter((frame) => frame.type === 'watch');

        expect(watches).toEqual([{ type: 'watch', data: { scope: 'studio-nord' } }]);
    });

    it('asks to hear about a model, and about one of its records', () => {
        const socket = connect();

        socket.receive({ type: 'auth_success', data: {} });
        realtime.subscribe('engram');
        realtime.subscribe('engram', 42);

        expect(socket.sent.filter((frame) => frame.type === 'subscribe')).toEqual([
            { type: 'subscribe', data: { channels: ['engram'] } },
            { type: 'subscribe', data: { channels: ['engram:42'] } },
        ]);
    });

    it('asks once for the same channel', () => {
        const socket = connect();

        socket.receive({ type: 'auth_success', data: {} });
        realtime.subscribe('engram', 42);
        realtime.subscribe('engram', 42);

        expect(socket.sent.filter((frame) => frame.type === 'subscribe')).toHaveLength(1);
    });

    it('stops hearing about what it unsubscribed from', () => {
        const socket = connect();

        socket.receive({ type: 'auth_success', data: {} });
        realtime.subscribe('engram', 42);
        realtime.unsubscribe('engram', 42);
        realtime.unsubscribe('engram', 42);

        expect(socket.sent.filter((frame) => frame.type === 'unsubscribe')).toEqual([
            { type: 'unsubscribe', data: { channels: ['engram:42'] } },
        ]);
    });

    it('garde le canal tant qu’un écran l’écoute encore', () => {
        const socket = connect();

        socket.receive({ type: 'auth_success', data: {} });
        realtime.subscribe('workspace_extra_field');
        realtime.subscribe('workspace_extra_field');
        realtime.unsubscribe('workspace_extra_field');

        expect(socket.sent.filter((frame) => frame.type === 'unsubscribe')).toHaveLength(0);

        realtime.unsubscribe('workspace_extra_field');

        expect(socket.sent.filter((frame) => frame.type === 'unsubscribe')).toEqual([
            { type: 'unsubscribe', data: { channels: ['workspace_extra_field'] } },
        ]);
    });

    it('redemande un canal relâché puis repris', () => {
        const socket = connect();

        socket.receive({ type: 'auth_success', data: {} });
        realtime.subscribe('engram');
        realtime.unsubscribe('engram');
        realtime.subscribe('engram');

        expect(socket.sent.filter((frame) => frame.type === 'subscribe')).toHaveLength(2);
    });

    it('says its subscriptions again on a new socket', () => {
        vi.useFakeTimers();

        const first = connect();

        first.receive({ type: 'auth_success', data: {} });
        realtime.subscribe('engram', 42);
        first.close();
        vi.advanceTimersByTime(1000);

        const second = sockets.at(-1);

        second.onopen();
        second.receive({ type: 'auth_success', data: {} });

        expect(second.sent.at(-1)).toEqual({ type: 'subscribe', data: { channels: ['engram:42'] } });

        vi.useRealTimers();
    });

    it('tells the views to read again when it comes back', () => {
        vi.useFakeTimers();

        const heard = [];
        const listener = () => heard.push('reconnected');

        bus.addEventListener('realtime:reconnected', listener);

        const first = connect();

        first.receive({ type: 'auth_success', data: {} });

        expect(heard).toEqual([]);

        first.close();
        vi.advanceTimersByTime(1000);

        const second = sockets.at(-1);

        second.onopen();
        second.receive({ type: 'auth_success', data: {} });

        expect(heard).toEqual(['reconnected']);

        bus.removeEventListener('realtime:reconnected', listener);
        vi.useRealTimers();
    });

    it('reopens a socket that closed on its own', () => {
        vi.useFakeTimers();

        const socket = connect();

        socket.receive({ type: 'auth_success', data: {} });
        socket.close();

        expect(sockets).toHaveLength(1);

        vi.advanceTimersByTime(1000);

        expect(sockets).toHaveLength(2);

        vi.useRealTimers();
    });

    it('stays closed once the token was refused', () => {
        vi.useFakeTimers();

        const socket = connect();

        socket.receive({ type: 'auth_error', data: { message: 'Invalid authentication token' } });
        socket.close();
        vi.advanceTimersByTime(60000);

        expect(sockets).toHaveLength(1);

        vi.useRealTimers();
    });

    it('goes quiet when asked to disconnect', () => {
        vi.useFakeTimers();

        const socket = connect();

        realtime.disconnect();
        vi.advanceTimersByTime(60000);

        expect(socket.closed).toBe(true);
        expect(sockets).toHaveLength(1);

        vi.useRealTimers();
    });
});

describe('realtime heartbeat and connection notice', () => {
    beforeEach(() => {
        realtime.disconnect();
        sockets.length = 0;
        vi.stubGlobal('WebSocket', FakeWebSocket);
    });

    it('says it is connected on every handshake, and whether it had been before', () => {
        const seen = [];
        const listener = (event) => seen.push(event.detail);

        bus.addEventListener('realtime:connected', listener);

        const socket = connect();
        socket.receive({ type: 'auth_success' });
        socket.close();
        lastSocket().onopen();
        lastSocket().receive({ type: 'auth_success' });

        bus.removeEventListener('realtime:connected', listener);

        expect(seen).toEqual([{ reconnected: false }, { reconnected: true }]);
    });

    it('keeps the connection alive while it is authenticated', () => {
        vi.useFakeTimers();

        const socket = connect();
        socket.receive({ type: 'auth_success' });
        socket.sent.length = 0;

        vi.advanceTimersByTime(60000);

        expect(socket.sent).toEqual([
            { type: 'heartbeat', data: null },
            { type: 'heartbeat', data: null },
        ]);

        vi.useRealTimers();
    });

    it('stops saying it once the socket is gone', () => {
        vi.useFakeTimers();

        const socket = connect();
        socket.receive({ type: 'auth_success' });
        realtime.disconnect();
        socket.sent.length = 0;

        vi.advanceTimersByTime(60000);

        expect(socket.sent).toEqual([]);

        vi.useRealTimers();
    });
});
