export type FieldError = {
    /**
     * Its path in the body: `items[0].value`
     */
    field: string;
    /**
     * The name the metadata give the field, none when they do not describe it
     */
    label: string | undefined;
    message: string;
    type: string;
    /**
     * The message named by the label of its field, « Field Email: not an email »; alone
     * for a field the metadata do not name
     */
    described: string;
};
export type FormattedError = {
    title: string;
    /**
     * What it says about a field
     */
    fieldErrors: FieldError[];
    /**
     * What it says about none
     */
    messages: string[];
    /**
     * Each thing it says: its messages, then its field errors, each named by its field
     */
    points: string[];
    /**
     * The error in one message, for a toast or a dialog: a point alone, or the title
     * over its points, one bullet each; the title when it says none
     */
    fullMessage: string;
};
/**
 * What an error says about a field of the body.
 *
 * @typedef {Object} FieldError
 * @property {string} field Its path in the body: `items[0].value`
 * @property {string|undefined} label The name the metadata give the field, none when they do not describe it
 * @property {string} message
 * @property {string} type
 * @property {string} described The message named by the label of its field, « Field Email: not an email »; alone
 *   for a field the metadata do not name
 */
/**
 * An error worded for the screen.
 *
 * @typedef {Object} FormattedError
 * @property {string} title
 * @property {FieldError[]} fieldErrors What it says about a field
 * @property {string[]} messages What it says about none
 * @property {string[]} points Each thing it says: its messages, then its field errors, each named by its field
 * @property {string} fullMessage The error in one message, for a toast or a dialog: a point alone, or the title
 *   over its points, one bullet each; the title when it says none
 */
/**
 * The error a call of the fetcher failed with, worded for the screen: the reason the server gives (`detail` as a
 * text, or the `message` of a `detail` object, else the `message` or `error` of the body), `defaultMessage` when it
 * gives none (the network down, an answer without a body), « An error occurred » without one.
 *
 * A validation error (`detail` as a list, FastAPI's HTTPValidationError) is titled « Validation error »: what it
 * says about a field of the body goes to `fieldErrors`, its path read from `loc` (`["body", "items", 0, "value"]`
 * to `items[0].value`) and named by its label in `fields`, the metadata of the model written; the rest to
 * `messages`, a position in the body included (`["body", 12]`, a JSON that does not parse). The prefix pydantic
 * gives the message of a validator (« Value error, », « Assertion failed, ») is left out.
 *
 * The same as `formatApiError` of flutter_fastedgy.
 *
 * @param {any} error The error of the call, its body as `data` (`details` or `response.data` read as well)
 * @param {{ defaultMessage?: string, fields?: Record<string, { label?: string }> }} [options]
 * @returns {FormattedError}
 */
export declare function formatApiError(error: any, { defaultMessage, fields }?: {
    defaultMessage?: string;
    fields?: Record<string, {
        label?: string;
    }>;
}): FormattedError;
/**
 * The error a call failed with in one message (`fullMessage` of {@link formatApiError}). The same as
 * `formatValidationErrors` of flutter_fastedgy.
 *
 * @param {any} error The error of the call, its body as `data`
 * @param {string} [defaultMessage] What to say when the server named no reason, already translated by the caller
 * @param {Record<string, { label?: string }>} [fields] The metadata of the model written, naming its fields
 * @returns {string | undefined} The message, undefined without an error
 */
export declare function formatValidationErrors(error: any, defaultMessage?: string, fields?: Record<string, {
    label?: string;
}>): string | undefined;
//# sourceMappingURL=validations.d.ts.map