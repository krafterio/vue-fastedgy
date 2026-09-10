/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { computed, onBeforeUnmount, onMounted, readonly, ref, shallowRef, toValue, watch } from 'vue';

/**
 * What a file drag over the page looks like, and who is willing to take it.
 *
 * A browser drops a file wherever it lands: on a text field it replaces what is
 * typed, on the page it navigates away from the application. Nothing warns of
 * it, and nothing says which part of the screen would have done something
 * useful with it.
 *
 * So the page keeps one piece of state — a file is being dragged, and it is of
 * these kinds — and every place that can take one says so. What is drawn from
 * that is the application's: a veil over what cannot take the file, whatever
 * marks the places that can.
 */

/** How many dragged things are currently over the page, enters minus leaves. */
const depth = ref(0);

/** The MIME types the drag carries, as the browser names them. */
const carried = shallowRef([]);

/** The zones that said they would take it, in the order they registered. */
const zones = ref([]);

let listening = 0;

const FILE_KIND = 'Files';

/** Whether what is being dragged is files rather than a selection of text. */
const filesIn = (transfer) => [...(transfer?.types ?? [])].includes(FILE_KIND);

/**
 * The MIME types of what is dragged, which the browser only tells while it is
 * dragged: during a drag `items` says the kind of each file but not its name,
 * and `files` is empty until the drop.
 */
const kindsIn = (transfer) =>
    [...(transfer?.items ?? [])].filter((item) => item.kind === 'file').map((item) => item.type);

function onEnter(event) {
    if (!filesIn(event.dataTransfer)) {
        return;
    }

    depth.value += 1;
    carried.value = kindsIn(event.dataTransfer);
}

function onLeave(event) {
    if (filesIn(event.dataTransfer)) {
        depth.value = Math.max(0, depth.value - 1);
    }
}

function onOver(event) {
    // Or the browser refuses the drop before anything has a chance to take it.
    if (filesIn(event.dataTransfer)) {
        event.preventDefault();
    }
}

function rest() {
    depth.value = 0;
    carried.value = [];
}

function listen() {
    if (listening++ > 0) {
        return;
    }

    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', rest);
    window.addEventListener('dragend', rest);
}

function forget() {
    if (--listening > 0) {
        return;
    }

    window.removeEventListener('dragenter', onEnter);
    window.removeEventListener('dragleave', onLeave);
    window.removeEventListener('dragover', onOver);
    window.removeEventListener('drop', rest);
    window.removeEventListener('dragend', rest);
    rest();
}

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
export function useFileDrag() {
    onMounted(listen);
    onBeforeUnmount(forget);

    return {
        dragging: computed(() => depth.value > 0),
        kinds: readonly(carried),
        zones: readonly(zones),
    };
}

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
export function useFileDropZone(target, options = {}) {
    const { dragging, kinds } = useFileDrag();
    const entered = ref(false);

    const accepts = computed(() => (options.accept ? options.accept([...kinds.value]) : true));
    const active = computed(() => dragging.value && accepts.value);

    const element = () => toValue(target) ?? null;

    const enter = () => (entered.value = true);
    const leave = () => (entered.value = false);

    // Read rather than kept in step: a drag that ends anywhere on the page ends
    // over this too, and nothing has to be told about it.
    const over = computed(() => dragging.value && entered.value);

    let listened = null;

    const attach = () => {
        const found = element();

        if (found === listened) {
            return;
        }

        detach();

        if (found) {
            found.addEventListener('dragenter', enter);
            found.addEventListener('dragleave', leave);
            found.addEventListener('drop', leave);
            listened = found;
            zones.value = [...zones.value, { element: found, accepts }];
        }
    };

    function detach() {
        if (!listened) {
            return;
        }

        listened.removeEventListener('dragenter', enter);
        listened.removeEventListener('dragleave', leave);
        listened.removeEventListener('drop', leave);
        zones.value = zones.value.filter((zone) => zone.element !== listened);
        listened = null;
    }

    onMounted(attach);
    onBeforeUnmount(detach);
    watch(() => toValue(target), attach);

    return { active, over };
}
