/**
 * Clean payload by converting undefined and empty strings to null
 * Recursively processes nested objects and arrays
 * @param {any} value - Value to clean
 * @returns {any} - Cleaned value
 */
export declare function cleanPayload(value: any): any;
/**
 * The text a field holds, or nothing when it holds only spaces.
 *
 * @param {any} value
 * @returns {String|null}
 */
export declare function trimmedOrNull(value: any): string | null;
/**
 * The number a field holds, or nothing when it holds nothing readable.
 *
 * @param {any} value
 * @returns {Number|null}
 */
export declare function numberOrNull(value: any): number | null;
//# sourceMappingURL=models.d.ts.map