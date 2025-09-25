/**
 * Ensures a bus event listener is attached and cleared the proper way.
 *
 * @param {EventBus} bus
 * @param {string} eventName
 * @param {EventListener} callback
 */
export function useBus(bus: EventBus, eventName: string, callback: EventListener): void;
export class EventBus extends EventTarget {
    listeners: Map<any, any>;
    addEventListener(type: any, listener: any, options: any): void;
    removeEventListener(type: any, listener: any, options: any): void;
    trigger(name: any, payload: any): void;
    triggerAndWait(name: any, payload: any): Promise<void>;
}
export const bus: EventBus;
//# sourceMappingURL=bus.d.ts.map