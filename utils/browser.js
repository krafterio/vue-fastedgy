/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

/**
 * Read a value the caller names by its path, whatever the depth.
 *
 * @param {object|null} source
 * @param {String} path - Dot notation path (e.g. 'category.name')
 * @param {*} [defaultValue] - What to answer when the path leads nowhere
 * @returns {*}
 */
export function getNestedValue(source, path, defaultValue) {
    if (!source || !path) {
        return defaultValue;
    }

    return path.split('.').reduce((held, part) => held?.[part], source) ?? defaultValue;
}

/**
 * Hand a file the application received to whoever is looking at it.
 *
 * @param {Blob} blob
 * @param {String} filename - Name the file is saved under
 */
export function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(url);
}
