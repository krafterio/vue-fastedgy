/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { onBeforeUnmount, onMounted } from 'vue';

export class EventBus extends EventTarget {
    constructor() {
        super();
        this.listeners = new Map();
    }

    addEventListener(type, listener, options) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }

        this.listeners.get(type).add(listener);

        return super.addEventListener(type, listener, options);
    }

    removeEventListener(type, listener, options) {
        const listeners = this.listeners.get(type);

        if (listeners) {
            listeners.delete(listener);
        }

        return super.removeEventListener(type, listener, options);
    }

    trigger(name, payload) {
        this.dispatchEvent(new CustomEvent(name, { detail: payload }));
    }

    async triggerAndWait(name, payload) {
        const listeners = this.listeners.get(name);

        if (!listeners || listeners.size === 0) {
            return;
        }

        const event = new CustomEvent(name, { detail: payload });
        const promises = [];

        for (const listener of listeners) {
            const result = listener(event);
            if (result instanceof Promise) {
                promises.push(result);
            }
        }

        if (promises.length > 0) {
            await Promise.all(promises);
        }
    }
}

export const bus = new EventBus();

/**
 * Ensures a bus event listener is attached and cleared the proper way.
 *
 * @param {EventBus} bus
 * @param {string} eventName
 * @param {EventListener} callback
 */
export function useBus(bus, eventName, callback) {
    onMounted(() => {
        bus.addEventListener(eventName, callback);
    });

    onBeforeUnmount(() => {
        bus.removeEventListener(eventName, callback);
    });
}
