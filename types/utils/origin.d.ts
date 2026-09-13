/**
 * The header naming the client instance behind a write.
 *
 * @type {String}
 */
export declare const ORIGIN_HEADER: string;
/**
 * This running instance of the application, for the life of this page.
 *
 * Stamped on every request so the server can hand it back on the announcement
 * of that write, which is how this instance recognises its own echo and leaves
 * it alone rather than re-reading what it just wrote.
 *
 * Per page load, never persisted: a second tab must have its own, and a reload
 * must get a new one, its holders being new and owing themselves a full read.
 *
 * @type {String}
 */
export declare const originId: string;
/**
 * An origin of its own for one request: `<originId>.<n>`.
 *
 * A write the api layer announces carries one, so the socket drops the echo of
 * that request, and of it alone.
 *
 * @returns {String}
 */
export declare function requestOrigin(): string;
//# sourceMappingURL=origin.d.ts.map