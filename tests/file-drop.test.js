/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';

import { useFileDrag, useFileDropZone } from '../composables/file-drop.js';

const mounted = [];

afterEach(() => {
    while (mounted.length > 0) {
        mounted.pop().unmount();
    }
});

/** A drag carrying files of these kinds, as a browser describes one. */
const carrying = (kind, ...kinds) =>
    new (class extends Event {
        dataTransfer = {
            types: ['Files'],
            items: [kind, ...kinds].map((type) => ({ kind: 'file', type })),
        };
    })(kind === undefined ? 'dragend' : 'dragenter', { bubbles: true });

const dragEnter = (...kinds) => {
    const event = carrying(...kinds);

    window.dispatchEvent(event);

    return event;
};

function watcher() {
    let seen = null;

    const component = mount(
        defineComponent({
            setup() {
                seen = useFileDrag();

                return () => h('div');
            },
        })
    );

    mounted.push(component);

    return seen;
}

function zone(options = {}) {
    let seen = null;

    const component = mount(
        defineComponent({
            setup() {
                const element = ref(null);

                seen = { ...useFileDropZone(element, options), element };

                return () => h('div', { ref: element });
            },
        }),
        { attachTo: document.body }
    );

    mounted.push(component);

    return seen;
}

describe('useFileDrag', () => {
    it('says a file is being dragged, and of which kinds', async () => {
        const drag = watcher();

        expect(drag.dragging.value).toBe(false);

        dragEnter('image/png');

        expect(drag.dragging.value).toBe(true);
        expect([...drag.kinds.value]).toEqual(['image/png']);

        window.dispatchEvent(new Event('drop'));

        expect(drag.dragging.value).toBe(false);
    });

    it('ignores a drag carrying no file, a selection of text being one', () => {
        const drag = watcher();

        window.dispatchEvent(
            Object.assign(new Event('dragenter'), { dataTransfer: { types: ['text/plain'], items: [] } })
        );

        expect(drag.dragging.value).toBe(false);
    });

    it('counts what enters and what leaves, a page having many elements', () => {
        const drag = watcher();

        dragEnter('image/png');
        dragEnter('image/png');

        window.dispatchEvent(Object.assign(new Event('dragleave'), { dataTransfer: { types: ['Files'] } }));

        expect(drag.dragging.value).toBe(true);

        window.dispatchEvent(Object.assign(new Event('dragleave'), { dataTransfer: { types: ['Files'] } }));

        expect(drag.dragging.value).toBe(false);
    });
});

describe('useFileDropZone', () => {
    it('wakes only for a file it would take', () => {
        const pictures = zone({ accept: (kinds) => kinds.every((kind) => kind.startsWith('image/')) });

        dragEnter('application/pdf');

        expect(pictures.active.value).toBe(false);

        window.dispatchEvent(new Event('drop'));
        dragEnter('image/png');

        expect(pictures.active.value).toBe(true);
    });

    it('takes anything where it says nothing', () => {
        const anything = zone();

        dragEnter('application/pdf');

        expect(anything.active.value).toBe(true);
    });

    it('says when the file is over it, and stops when the drag is over', async () => {
        const target = zone();

        dragEnter('image/png');
        target.element.value.dispatchEvent(new Event('dragenter'));

        expect(target.over.value).toBe(true);

        window.dispatchEvent(new Event('drop'));
        await nextTick();

        expect(target.over.value).toBe(false);
    });

    it('lists itself among the places that would take one, and stops on unmount', () => {
        const drag = watcher();

        expect(drag.zones.value).toHaveLength(0);

        zone();

        expect(drag.zones.value).toHaveLength(1);

        mounted.pop().unmount();

        expect(drag.zones.value).toHaveLength(0);
    });
});
