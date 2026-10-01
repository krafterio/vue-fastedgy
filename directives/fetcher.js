/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { useFetcher } from '../composables/fetcher.js';
import { absoluteUrl } from '../plugins/fetcher.js';

const DOWNLOAD_ROUTE = '/storage/download/';
const SIGNED_DOWNLOAD_ROUTE = '/storage/download-url/';

/**
 * Show an image or a video the fetcher reads, token included: `<img :src="url" v-fetcher-src />`.
 *
 * The directive takes the `src` off the element before Vue writes it, so the browser never asks for
 * the url on its own: the element stays invisible until the blob the fetcher read is loaded, and
 * says `error` when the read fails. A `data:` or `blob:` url is left to the element as is. `.lazy`
 * waits for the element to come into view, and `{ optimize: false }` reads the file as stored
 * rather than at the size the element is displayed.
 *
 * A `<video>` or an `<audio>` from a download route plays from a url the server signs, read by ranges
 * as it plays, and shows once its metadata is loaded, since it never fires `load`. From a server that
 * signs no url it is read whole, and keeps its blob for as long as it is displayed. Either way it is
 * read as stored.
 */
export const fetcherSrc = {
    created(el, binding, vnode) {
        take(el, vnode);
    },
    mounted(el, binding) {
        show(el, binding);
    },
    beforeUpdate(el, binding, vnode) {
        take(el, vnode);
    },
    updated(el, binding) {
        // Only a url the caller changed asks for another read: the parent rendering again
        // leaves the image it already shows.
        if (el.takenSrc !== el.lastSrc) {
            release(el);
            show(el, binding);
        }
    },
    beforeUnmount(el) {
        release(el);
        delete el.takenSrc;
        delete el.lastSrc;
    },
};

/** The props Vue is about to write lose their `src`, which the directive reads itself. */
function take(el, vnode) {
    const src = vnode.props?.src;
    el.takenSrc = src;

    if (src && !isLocal(src)) {
        delete vnode.props.src;
    }
}

function isLocal(src) {
    return src.startsWith('data:') || src.startsWith('blob:');
}

function show(el, binding) {
    const src = el.takenSrc;
    el.lastSrc = src;

    if (!src || isLocal(src)) {
        return;
    }

    el.initialOpacity ??= el.style.opacity;
    el.style.opacity = '0';

    if (binding.modifiers.lazy) {
        observe(el, binding);
    } else {
        load(el, binding);
    }
}

function observe(el, binding) {
    el.intersectionObserver = new IntersectionObserver(
        (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                el.intersectionObserver.disconnect();
                delete el.intersectionObserver;
                load(el, binding);
            }
        },
        { threshold: 0.1 }
    );

    el.intersectionObserver.observe(el);
}

function load(el, binding) {
    el.fetcher = useFetcher({ abortOnUnmounted: false });

    if (isMedia(el) && el.lastSrc.includes(DOWNLOAD_ROUTE)) {
        stream(el, binding);
    } else {
        read(el, binding);
    }
}

/**
 * A video or an audio plays from a url the server signs: the element reads it by ranges as it plays,
 * never waiting for the whole file. A server that signs no url answers 404, and the file is read whole.
 */
function stream(el, binding) {
    el.fetcher
        .get(absoluteUrl(el.lastSrc.replace(DOWNLOAD_ROUTE, SIGNED_DOWNLOAD_ROUTE)))
        .then((response) => {
            el.onloadedmetadata = () => reveal(el);
            el.src = response.data.url;
        })
        .catch((e) => (404 === e.response?.status ? read(el, binding) : fail(el, e)));
}

function read(el, binding) {
    const params = optimizationParams(el, binding);

    el.fetcher
        .get(absoluteUrl(el.lastSrc), params ? { params } : undefined)
        .then(async (response) => {
            const url = URL.createObjectURL(await response.blob());

            el.blobUrl = url;

            if (isMedia(el)) {
                el.onloadedmetadata = () => reveal(el);
            } else {
                el.onload = () => {
                    reveal(el);
                    URL.revokeObjectURL(url);
                    delete el.blobUrl;
                };
            }

            el.src = url;
        })
        .catch((e) => fail(el, e));
}

function fail(el, e) {
    if (!['AbortError', undefined].includes(e.name)) {
        console.error('[v-fetcher-src] fetch error', e);
        el.dispatchEvent(new Event('error'));
    }
}

function isMedia(el) {
    return el instanceof HTMLMediaElement;
}

function reveal(el) {
    el.style.opacity = el.initialOpacity ?? '';
    delete el.initialOpacity;
}

function release(el) {
    el.intersectionObserver?.disconnect();
    delete el.intersectionObserver;
    el.fetcher?.abort();
    delete el.fetcher;

    if (el.blobUrl) {
        URL.revokeObjectURL(el.blobUrl);
        delete el.blobUrl;
    }

    if (el.initialOpacity !== undefined) {
        el.style.opacity = el.initialOpacity;
        delete el.initialOpacity;
    }
}

function optimizationParams(el, binding) {
    if (false === binding.value?.optimize || isMedia(el)) {
        return null;
    }

    const params = { e: 'webp' };
    const width = detectDisplaySize(el, 'width');

    if (width) {
        params.w = width;

        const height = detectDisplaySize(el, 'height');

        if (height && 'cover' === getComputedStyle(el).objectFit) {
            params.h = height;
            params.m = 'cover';
        }
    }

    return params;
}

function detectDisplaySize(el, dimension) {
    let size = el.getBoundingClientRect()[dimension];

    if (!size && el.parentElement) {
        size = el.parentElement.getBoundingClientRect()[dimension];
    }

    if (!size) {
        return null;
    }

    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    return Math.min(Math.ceil((size * ratio) / 100) * 100, 1920);
}
