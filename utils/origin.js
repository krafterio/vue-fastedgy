/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

/**
 * The header naming the client instance behind a write.
 *
 * @type {String}
 */
export const ORIGIN_HEADER = 'X-Origin-Id';

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
export const originId = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `o-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
