/**
 * Page size of a list, remembered under `storageKey` when the holder asks for it.
 *
 * A holder that names no key reads and writes nothing: its size is the one it was
 * given, and another list's remembered choice does not decide for it.
 *
 * @param {number|string|null} queryParam - Size read from the url
 * @param {Array<number>} availableSizes - Sizes the holder offers
 * @param {number} defaultSize - Size to fall back on
 * @param {string|null} [storageKey] - Where the choice is remembered
 * @returns {import("vue").Ref<number>}
 */
export declare function usePageSize(queryParam: number | string | null, availableSizes: Array<number>, defaultSize: number, storageKey?: string | null): import("vue").Ref<number>;
//# sourceMappingURL=page-size.d.ts.map