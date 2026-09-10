/**
 * The file drag going on over the page, if any.
 *
 * Shared by everything that asks: one set of listeners on the window, however
 * many screens and fields are watching.
 *
 * @returns {{
 *  dragging: import('vue').Ref<boolean>,
 *  kinds: import('vue').Ref<string[]>,
 *  zones: import('vue').Ref<Array<{ element: HTMLElement, accepts: boolean }>>,
 * }}
 */
export declare function useFileDrag(): {
    dragging: import('vue').Ref<boolean>;
    kinds: import('vue').Ref<string[]>;
    zones: import('vue').Ref<Array<{
        element: HTMLElement;
        accepts: boolean;
    }>>;
};
/**
 * Says that [target] would take a file, and whether it would take this one.
 *
 * Declarative on purpose: taking the file is still done where it was already
 * done — a `drop` listener, a ProseMirror plugin — and this only says the place
 * exists, so an application can draw it apart from what would swallow the file
 * for nothing.
 *
 * @param {import('vue').Ref<HTMLElement|null>|(() => HTMLElement|null)} target
 * @param {{ accept?: (kinds: string[]) => boolean }} [options] - What it takes;
 *   everything, where nothing is said
 * @returns {{ active: import('vue').Ref<boolean>, over: import('vue').Ref<boolean> }}
 *   `active` while a file it would take is being dragged anywhere on the page,
 *   `over` while that file is over it
 */
export declare function useFileDropZone(target: import('vue').Ref<HTMLElement | null> | (() => HTMLElement | null), options?: {
    accept?: (kinds: string[]) => boolean;
}): {
    active: import('vue').Ref<boolean>;
    over: import('vue').Ref<boolean>;
};
//# sourceMappingURL=file-drop.d.ts.map