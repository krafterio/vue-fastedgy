/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

/**
 * Clean payload by converting undefined and empty strings to null
 * Recursively processes nested objects and arrays
 * @param {any} value - Value to clean
 * @returns {any} - Cleaned value
 */
export function cleanPayload(value) {
    // Convert undefined and empty strings to null
    if (value === undefined || value === '') {
        return null;
    }

    // Handle arrays recursively
    if (Array.isArray(value)) {
        return value.map(item => cleanPayload(item));
    }

    // Handle objects recursively (but not Date, File, FormData, etc.)
    if (value !== null && typeof value === 'object' && value.constructor === Object) {
        const cleaned = {};
        for (const [key, val] of Object.entries(value)) {
            cleaned[key] = cleanPayload(val);
        }
        return cleaned;
    }

    // Return other values as-is (numbers, booleans, Date, File, etc.)
    return value;
}
