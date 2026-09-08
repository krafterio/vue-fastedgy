/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetcherSrc } from '../directives/fetcher.js';

const image = (payload = 'x') => ({
    ok: true,
    status: 200,
    headers: { get: () => 'image/webp' },
    blob: async () => new Blob([payload], { type: 'image/webp' }),
});

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('v-fetcher-src', () => {
    let fetchSpy;

    beforeEach(() => {
        fetchSpy = vi.fn().mockResolvedValue(image());
        window.fetch = fetchSpy;
        window.URL.createObjectURL = vi.fn(() => 'blob:one');
        window.URL.revokeObjectURL = vi.fn();
    });

    const screen = (source) =>
        mount(
            {
                props: { src: String, tick: Number },
                template: '<img :src="src" v-fetcher-src /><span>{{ tick }}</span>',
            },
            {
                props: { src: source, tick: 0 },
                global: { directives: { 'fetcher-src': fetcherSrc } },
            }
        );

    it('reads the image once, whatever its parent renders next', async () => {
        const wrapper = screen('/storage/download/plate.png');

        await settled();
        expect(fetchSpy).toHaveBeenCalledTimes(1);

        // The browser saying the blob is displayed: what tells the directive
        // the image is loaded, and what a jsdom image never does on its own.
        wrapper.get('img').element.onload();

        await wrapper.setProps({ tick: 1 });
        await wrapper.setProps({ tick: 2 });
        await settled();

        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('reads it again when the source it was given changes', async () => {
        const wrapper = screen('/storage/download/plate.png');

        await settled();
        await wrapper.setProps({ src: '/storage/download/other.png' });
        await settled();

        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
});
