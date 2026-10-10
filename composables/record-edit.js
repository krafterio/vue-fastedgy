/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { reactive, ref, toValue } from 'vue';
import { useApiModel } from './api.js';
import { useMetadataStore } from '../stores/metadata.js';
import { relationKindOf } from '../utils/query-fields.js';
import { formatValidationErrors } from '../utils/validations.js';

const pad = (number) => String(number).padStart(2, '0');

/**
 * A value as a row holds it: a date as its day, an instant in UTC.
 *
 * @param {import('../stores/metadata.js').MetadataField|null} field
 * @param {any} value
 * @returns {any}
 */
function shownOf(field, value) {
    if (value instanceof Date) {
        return field?.type === 'date'
            ? `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
            : value.toISOString();
    }

    return Array.isArray(value) ? value.map((one) => shownOf(field, one)) : value;
}

/**
 * What a row holds of a field as the server takes it: a relation as its id, or their ids.
 *
 * @param {import('../stores/metadata.js').MetadataField|null} field
 * @param {any} shown
 * @returns {any}
 */
function sentOf(field, shown) {
    const idOf = (one) => (one !== null && typeof one === 'object' ? (one.id ?? null) : (one ?? null));

    switch (relationKindOf(field)) {
        case 'single':
            return idOf(shown);
        case 'multiple':
            return (shown ?? []).map(idOf);
        default:
            return shown;
    }
}

const same = (one, other) => JSON.stringify(one ?? null) === JSON.stringify(other ?? null);

/**
 * The cells of records edited in place: a value shows at once, then is
 * written, the answer taking the place of the row. A refusal puts the value
 * back and keeps the message of the server on its cell, or on its row when it
 * names no field. Nothing is thrown: `edit` and `create` give null for a
 * refusal, and `onError` hears of it.
 *
 * Given the list that shows the rows, a row changes there, moving to the
 * group of its new value, the answer is read with the fields of the list, and
 * a refresh the list is asked meanwhile waits for the write. Without one, the
 * row given is changed in place.
 *
 * @param {string|object} model - Model name or an api model (useXxxApiModel())
 * @param {Object} [options]
 * @param {Object} [options.list] - The data iterator that shows the rows
 * @param {(item: Object, field: string, value: any) => Promise<Record<string, any>|null>} [options.write] - Writes a
 *   value in place of the route of the model (a service that normalizes what it receives); given the value as the
 *   route would take it, it gives the row saved, null to keep the one shown
 * @param {Array<string>|Function|import('vue').Ref<Array<string>>} [options.fields] - The fields the answer is read
 *   with, those of the list otherwise
 * @param {(error: any) => void} [options.onError] - Told of each refusal once its messages are kept: a toast, for one
 * @param {object} [options.params] - The parameters of the api model made from a model name
 * @returns {{ edit: Function, create: Function, isSaving: Function, errorOf: Function, rowErrorOf: Function }}
 *
 * @example
 * const cells = useRecordEdit(useFlowApiModel(), {
 *     list,
 *     onError: (error) => toast.error(formatValidationErrors(error)),
 * });
 *
 * await cells.edit(row, 'status', { id: 3, name: 'Done' });
 */
export function useRecordEdit(model, options = {}) {
    const { list = null, write = null, onError = null } = options;
    const api = typeof model === 'string' ? useApiModel(model, options.params ?? {}) : model;
    const modelName = api.modelName ?? model;
    const metadataStore = useMetadataStore();

    const saving = reactive(new Set());
    const errors = reactive(new Map());
    const rowErrors = reactive(new Map());
    const creating = ref(false);

    const keyOf = (id, field) => JSON.stringify([id ?? null, field]);

    const fieldsOf = async () => {
        const metadata = await Promise.resolve(metadataStore.getMetadata(modelName)).catch(() => null);

        return metadata?.fields ?? {};
    };

    const readFields = () => toValue(options.fields) ?? list?.fields?.value ?? null;

    // A write of the list, whose echo it then leaves unread.
    const run = (task) => (list ? list.writing(task) : task());

    /**
     * Keep what the server said of a row: by field, or for the whole row when it names none.
     */
    const keep = (id, failure) => {
        const detail = failure?.data?.detail;
        const byField = Array.isArray(detail) ? detail.filter((one) => Array.isArray(one?.loc) && one.msg) : [];

        if (byField.length === 0) {
            rowErrors.set(id ?? null, formatValidationErrors(failure, failure?.message));

            return;
        }

        errors.set(id ?? null, {
            ...errors.get(id ?? null),
            ...Object.fromEntries(
                byField.map((one) => [one.loc.slice(one.loc[0] === 'body' ? 1 : 0).join('.'), one.msg])
            ),
        });
    };

    const forget = (id, field) => {
        const held = errors.get(id ?? null);

        if (held && field in held) {
            const rest = { ...held };

            delete rest[field];
            errors.set(id ?? null, rest);
        }

        rowErrors.delete(id ?? null);
    };

    // A row shown with a value: in the list, which moves it to the group of
    // that value, or in place.
    const show = (item, values) => {
        if (list) {
            const next = { ...(list.byId(item.id) ?? item), ...values };

            list.upsertLocal(next);

            return next;
        }

        Object.assign(item, values);

        return item;
    };

    /**
     * Show a value in a field of a row at once, then write it: a relation as
     * its id, several as their ids, a date as its day, an instant in UTC. A
     * value the row already holds writes nothing.
     *
     * @param {Object} item
     * @param {string} field
     * @param {any} value
     * @returns {Promise<Record<string, any>|null>} - The row saved, null when it was refused
     */
    const edit = async (item, field, value) => {
        const info = (await fieldsOf())[field] ?? null;
        const shown = shownOf(info, value);
        const sent = sentOf(info, shown);
        const id = item.id;

        if (same(sent, sentOf(info, shownOf(info, item[field])))) {
            return item;
        }

        const key = keyOf(id, field);
        const before = item[field];

        saving.add(key);
        forget(id, field);

        const row = show(item, { [field]: shown });

        try {
            const fields = readFields();
            const saved = await run(async () =>
                write
                    ? write(item, field, sent)
                    : (await api.update(id, { [field]: sent }, fields ? { fields } : {}))?.data
            );

            if (saved && (write || fields)) {
                if (list) {
                    list.upsertLocal(saved);
                } else {
                    Object.assign(item, saved);
                }
            }

            return list ? (list.byId(id) ?? row) : item;
        } catch (failure) {
            show(item, { [field]: before });
            keep(id, failure);
            onError?.(failure);

            return null;
        } finally {
            saving.delete(key);
        }
    };

    /**
     * Create the record of a draft row from its values, written as `edit`
     * writes them, and add it at the start of the list.
     *
     * @param {Record<string, any>} values
     * @returns {Promise<Record<string, any>|null>} - The record created, null when it was refused, its messages kept
     *   on the draft
     */
    const create = async (values) => {
        const known = await fieldsOf();
        const payload = Object.fromEntries(
            Object.entries(values).map(([name, value]) => [
                name,
                sentOf(known[name] ?? null, shownOf(known[name] ?? null, value)),
            ])
        );

        creating.value = true;
        errors.delete(null);
        rowErrors.delete(null);

        try {
            const fields = readFields();
            const created = await run(async () => (await api.create(payload, fields ? { fields } : {}))?.data);

            list?.upsertLocal(created, { prepend: true });

            return created;
        } catch (failure) {
            keep(null, failure);
            onError?.(failure);

            return null;
        } finally {
            creating.value = false;
        }
    };

    return {
        edit,
        create,

        /**
         * Whether a field of a row is being written; of the draft row for null.
         * @param {Record<string, any>|null} item
         * @param {string} field
         * @returns {boolean}
         */
        isSaving: (item, field) => (item === null ? creating.value : saving.has(keyOf(item?.id, field))),

        /**
         * What the server said of a field of a row, of the draft row for null.
         * @param {Record<string, any>|null} item
         * @param {string} field
         * @returns {string|null}
         */
        errorOf: (item, field) => errors.get(item?.id ?? null)?.[field] ?? null,

        /**
         * What the server said of a row that names no field, of the draft row for null.
         * @param {Record<string, any>|null} item
         * @returns {string|null}
         */
        rowErrorOf: (item) => rowErrors.get(item?.id ?? null) ?? null,
    };
}
