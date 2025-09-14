/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

/**
 * Format validation errors from Pydantic in a readable text.
 *
 * @param {Error} error - The error object of api request
 * @returns {string | undefined} Formatted error message or undefined if no error
 */
export function formatValidationErrors(error, defaultMessage = undefined) {
    const errorDetail = error.data?.detail;
    defaultMessage = defaultMessage || "Erreur inconnue";

    if (!errorDetail) {
        return undefined;
    }

    if (typeof errorDetail === "string") {
        return errorDetail;
    }

    if (Array.isArray(errorDetail)) {
        if (errorDetail.length === 0) {
            return undefined;
        }

        if (errorDetail.length === 1) {
            const error = errorDetail[0];
            return error.msg || defaultMessage;
        }

        const errorItems = errorDetail.map((err) => {
            const field = err.loc ? err.loc.join(" → ") : "";
            const message = err.msg || "defaultMessage";
            return field ? `• ${field}: ${message}` : `• ${message}`;
        });

        return `${errorItems.join("\n")}`;
    } else if (typeof errorDetail === "string") {
        return errorDetail;
    }

    return fallbackMessage;
}
