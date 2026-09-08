/**
 * Format validation errors from Pydantic in a readable text.
 *
 * @param {Error} error - The error object of api request
 * @param {string} [defaultMessage] - What to say when the server named no reason, already translated by the caller
 * @returns {string | undefined} Formatted error message or undefined if no error
 */
export function formatValidationErrors(error: Error, defaultMessage?: string): string | undefined;
//# sourceMappingURL=validations.d.ts.map