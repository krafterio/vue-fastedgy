/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import {useFetcher} from '../composables/fetcher.js';
import {absoluteUrl} from '../plugins/fetcher.js';

export const fetcherSrc = {
    mounted(el, binding, node) {
        if (node.props.src && !node.props.src.startsWith('data:')) {
            el.lastSrc = node.props.src;
            const isLazy = binding.modifiers.lazy;

            if (isLazy) {
                setupLazyLoading(el, binding, node);
            } else {
                loadImage(el, binding, node);
            }
        }
    },
    updated(el, binding, node) {
        if (node.props.src && node.props.src !== el.lastSrc && !node.props.src.startsWith('data:')) {
            el.style.display = 'none';

            if (el.src && el.src.startsWith('blob:')) {
                URL.revokeObjectURL(el.src);
            }

            if (el.fetcher) {
                el.fetcher.abort();
                delete el.fetcher;
            }

            el.lastSrc = node.props.src;
            const isLazy = binding.modifiers.lazy;

            if (isLazy) {
                setupLazyLoading(el, binding, node);
            } else {
                loadImage(el, binding, node);
            }
        }
    },
    beforeUnmount(el) {
        if (el.src?.startsWith('blob:')) {
            URL.revokeObjectURL(el.src);
        }

        if (el.intersectionObserver) {
            el.intersectionObserver.disconnect();
            delete el.intersectionObserver;
        }

        delete el.lastSrc;
    },
    unmounted(el) {
        if (el.fetcher) {
            el.fetcher.abort();
            delete el.fetcher;
        }

        if (undefined !== el.initialOpacity) {
            delete el.initialOpacity;
        }
    }
}

function setupLazyLoading(el, binding, node) {
    el.initialOpacity = el.style.opacity;
        if (el.style.display === 'none') {
            el.style.opacity = 0;
            el.style.display = '';
        }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                loadImage(el, binding, node);
                observer.disconnect();
                delete el.intersectionObserver;
            }
        });
    }, {
        threshold: 0.1,
    });

    el.intersectionObserver = observer;
    observer.observe(el);
}

function loadImage(el, binding, node) {
    el.fetcher = useFetcher({abortOnUnmounted: false});
    const srcUrl = absoluteUrl(node.props.src);
    el.src = '';
    node.props.src = '';

    el.fetcher.get(srcUrl).then(async (response) => {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        el.onload = () => URL.revokeObjectURL(url);
        el.src = url;
        node.props.src = url;

        if (el.style.display === 'none') {
            el.style.display = '';
        }

        if (undefined !== el.initialOpacity) {
            el.style.opacity = el.initialOpacity;
            delete el.initialOpacity;
        }
    }).catch((e) => {
        console.error('[v-fetcher-src] fetch error', e);
    });
}
