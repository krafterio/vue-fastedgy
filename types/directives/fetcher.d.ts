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
export declare const fetcherSrc: {
    created(el: any, binding: any, vnode: any): void;
    mounted(el: any, binding: any): void;
    beforeUpdate(el: any, binding: any, vnode: any): void;
    updated(el: any, binding: any): void;
    beforeUnmount(el: any): void;
};
//# sourceMappingURL=fetcher.d.ts.map