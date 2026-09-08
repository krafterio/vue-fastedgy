/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { t } from "./i18n.js";

/**
 * Format validation errors from Pydantic in a readable text.
 *
 * @param {Error} error - The error object of api request
 * @param {string} [defaultMessage] - What to say when the server named no reason, already translated by the caller
 * @returns {string | undefined} Formatted error message or undefined if no error
 */
export function formatValidationErrors(error, defaultMessage = undefined) {
    const errorDetail = error.data?.detail;
    const fallback = defaultMessage || t("Unknown error");

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
            return errorDetail[0].msg || fallback;
        }

        const errorItems = errorDetail.map((err) => {
            const field = err.loc ? err.loc.join(" → ") : "";
            const message = err.msg || fallback;

            return field ? `• ${field}: ${message}` : `• ${message}`;
        });

        return errorItems.join("\n");
    }

    return fallback;
}
