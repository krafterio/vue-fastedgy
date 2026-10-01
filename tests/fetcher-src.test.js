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

const signed = (url) => ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({ url }),
});

const missing = () => ({
    ok: false,
    status: 404,
    statusText: 'Not Found',
    headers: { get: () => 'application/json' },
    json: async () => ({ detail: 'Not found' }),
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

    const screen = (source, template = '<img :src="src" v-fetcher-src @error="failed = true" />') =>
        mount(
            {
                props: { src: String, tick: Number },
                data: () => ({ failed: false }),
                template: `${template}<span>{{ tick }}</span>`,
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
        expect(wrapper.get('img').attributes('src')).toBe('blob:one');
    });

    it('reads it again when the url it was given changes', async () => {
        const wrapper = screen('/storage/download/plate.png');

        await settled();
        await wrapper.setProps({ src: '/storage/download/other.png' });
        await settled();

        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('keeps the url off the element, and shows it once the blob is loaded', async () => {
        const wrapper = screen('/storage/download/plate.png');
        const img = wrapper.get('img').element;

        expect(img.getAttribute('src')).toBeNull();
        expect(img.style.opacity).toBe('0');

        await settled();

        expect(img.getAttribute('src')).toBe('blob:one');
        expect(img.style.opacity).toBe('0');

        img.onload();

        expect(img.style.opacity).toBe('');
    });

    it('says error when the image cannot be read', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        fetchSpy.mockResolvedValue(missing());
        const wrapper = screen('/storage/download/gone.png');

        await settled();

        expect(wrapper.vm.failed).toBe(true);
        expect(wrapper.get('img').element.getAttribute('src')).toBeNull();
    });

    it('reads the size the element is displayed at, or the file as stored when not optimized', async () => {
        screen('/storage/download/plate.png');
        await settled();

        expect(String(fetchSpy.mock.calls[0][0])).toContain('e=webp');

        screen('/storage/download/plate.png', '<img :src="src" v-fetcher-src="{ optimize: false }" />');
        await settled();

        expect(String(fetchSpy.mock.calls[1][0])).not.toContain('e=webp');
    });

    it('shows a data url as is, without reading anything', async () => {
        const wrapper = screen('data:image/png;base64,AAAA');

        await settled();

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(wrapper.get('img').element.getAttribute('src')).toBe('data:image/png;base64,AAAA');
    });

    it('streams a video from the url the server signs, never reading the file itself', async () => {
        const create = vi.fn();
        window.URL.createObjectURL = create;
        fetchSpy.mockResolvedValue(signed('https://api.example/storage/signed/token'));
        const wrapper = screen('/acme/storage/download/clip.mp4', '<video :src="src" v-fetcher-src />');
        const video = wrapper.get('video').element;

        await settled();

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(String(fetchSpy.mock.calls[0][0])).toContain('/acme/storage/download-url/clip.mp4');
        expect(video.getAttribute('src')).toBe('https://api.example/storage/signed/token');
        expect(create).not.toHaveBeenCalled();
        expect(video.style.opacity).toBe('0');

        video.onloadedmetadata();

        expect(video.style.opacity).toBe('');
    });

    it('reads a video whole from a server that signs no url, and keeps its blob while it is displayed', async () => {
        const revoke = vi.fn();
        window.URL.revokeObjectURL = revoke;
        fetchSpy.mockResolvedValueOnce(missing()).mockResolvedValueOnce(image());
        const wrapper = screen('/storage/download/clip.mp4', '<video :src="src" v-fetcher-src />');
        const video = wrapper.get('video').element;

        await settled();

        expect(String(fetchSpy.mock.calls[1][0])).toContain('/storage/download/clip.mp4');
        expect(String(fetchSpy.mock.calls[1][0])).not.toMatch(/[?&](e|w)=/);
        expect(video.getAttribute('src')).toBe('blob:one');

        video.onloadedmetadata();

        expect(video.style.opacity).toBe('');
        expect(revoke).not.toHaveBeenCalled();

        wrapper.unmount();

        expect(revoke).toHaveBeenCalledWith('blob:one');
    });
});
