/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { t } from './i18n.js';

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
export function formatApiError(error, { defaultMessage, fields } = {}) {
    const fallback = formatted(defaultMessage || t('An error occurred'));
    const data = error?.data ?? error?.details ?? error?.response?.data;

    if (!data || typeof data !== 'object') {
        return fallback;
    }

    const detail = data.detail;

    if (typeof detail === 'string' && detail) {
        return formatted(detail);
    }

    if (typeof detail?.message === 'string' && detail.message) {
        return formatted(detail.message);
    }

    if (Array.isArray(detail)) {
        const fieldErrors = [];
        const messages = [];

        for (const item of detail) {
            const msg = reason(item);

            if (!msg) {
                continue;
            }

            const loc = item.loc;
            const path = Array.isArray(loc) && loc[0] === 'body' && typeof loc[1] === 'string' ? fieldPath(loc) : '';

            if (path) {
                fieldErrors.push(fieldError(path, msg, fields, item.type ?? 'unknown'));
            } else {
                messages.push(msg);
            }
        }

        return fieldErrors.length || messages.length
            ? formatted(t('Validation error'), fieldErrors, messages)
            : fallback;
    }

    for (const key of ['message', 'error']) {
        if (typeof data[key] === 'string' && data[key]) {
            return formatted(data[key]);
        }
    }

    return fallback;
}

/**
 * The error a call failed with in one message (`fullMessage` of {@link formatApiError}). The same as
 * `formatValidationErrors` of flutter_fastedgy.
 *
 * @param {any} error The error of the call, its body as `data`
 * @param {string} [defaultMessage] What to say when the server named no reason, already translated by the caller
 * @param {Record<string, { label?: string }>} [fields] The metadata of the model written, naming its fields
 * @returns {string | undefined} The message, undefined without an error
 */
export function formatValidationErrors(error, defaultMessage, fields) {
    return error ? formatApiError(error, { defaultMessage, fields }).fullMessage : undefined;
}

/** The prefix pydantic gives the message of a validator, by the type of the error. */
const VALIDATOR_PREFIXES = { value_error: 'Value error, ', assertion_error: 'Assertion failed, ' };

/**
 * What a validation error says, the prefix pydantic gives the message of a validator left out.
 *
 * @param {any} item
 * @returns {string|undefined} Nothing when it says nothing
 */
function reason(item) {
    const msg = item?.msg;

    if (typeof msg !== 'string' || !msg) {
        return undefined;
    }

    const prefix = VALIDATOR_PREFIXES[item.type];

    return prefix && msg.startsWith(prefix) ? msg.slice(prefix.length) : msg;
}

/**
 * @param {string} title
 * @param {FieldError[]} [fieldErrors]
 * @param {string[]} [messages]
 * @returns {FormattedError}
 */
function formatted(title, fieldErrors = [], messages = []) {
    const points = [...messages, ...fieldErrors.map((one) => one.described)];
    const fullMessage =
        points.length === 0
            ? title
            : points.length === 1
              ? points[0]
              : [title, ...points.map((point) => `• ${point}`)].join('\n');

    return { title, fieldErrors, messages, points, fullMessage };
}

/**
 * @param {string} field
 * @param {string} message
 * @param {Record<string, { label?: string }> | undefined} fields
 * @param {string} type
 * @returns {FieldError}
 */
function fieldError(field, message, fields, type) {
    const label = fields?.[field.split(/[.[]/)[0]]?.label || undefined;

    return {
        field,
        label,
        message,
        type,
        described: label ? t('Field {name}: {message}', { name: label, message }) : message,
    };
}

/**
 * The path of a field from the location of its error, `body` left out: `["body", "items", 0, "value"]` to
 * `items[0].value`.
 *
 * @param {Array<string|number>} loc
 * @returns {string}
 */
function fieldPath(loc) {
    const parts = [];

    for (const segment of loc.slice(1)) {
        if (typeof segment === 'number') {
            if (parts.length) {
                parts[parts.length - 1] += `[${segment}]`;
            } else {
                parts.push(`[${segment}]`);
            }
        } else {
            parts.push(String(segment));
        }
    }

    return parts.join('.');
}
