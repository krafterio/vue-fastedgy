/**
 * Read a value the caller names by its path, whatever the depth.
 *
 * @param {object|null} source
 * @param {String} path - Dot notation path (e.g. 'category.name')
 * @param {*} [defaultValue] - What to answer when the path leads nowhere
 * @returns {*}
 */
export declare function getNestedValue(source: object | null, path: string, defaultValue?: any): any;
/**
 * Hand a file the application received to whoever is looking at it.
 *
 * @param {Blob} blob
 * @param {String} filename - Name the file is saved under
 */
export declare function downloadBlob(blob: Blob, filename: string): void;
//# sourceMappingURL=browser.d.ts.map