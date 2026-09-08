/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { computed, reactive, ref, watch } from 'vue';
import { useApiModel } from './api.js';
import { useMetadataStore } from '../stores/metadata.js';

/**
 * Maps a server field type to the input component that edits it.
 *
 * This is the piece that decides whether a back-office scales. Without it,
 * every content type costs its own hand-written dialog. With it, a new model
 * becomes a list of column keys and nothing else.
 *
 * Anything unmapped falls back to a plain text input rather than throwing: an
 * unknown type must degrade to something editable, never break the screen.
 */
export const FIELD_WIDGETS = {
    string: 'text',
    text: 'textarea',
    email: 'text',
    url: 'text',
    password: 'text',
    integer: 'number',
    biginteger: 'number',
    float: 'number',
    decimal: 'number',
    boolean: 'switch',
    date: 'date',
    datetime: 'date',
    choice: 'choice',
    char_choice: 'choice',
    foreignkey: 'relation',
    onetoone: 'relation',
    manytomany: 'relations',
    json: 'textarea',
    file: 'file',
    image: 'file',
};

/** Fields the console never edits, whatever the model. */
const HIDDEN_FIELDS = new Set(['id', 'created_at', 'updated_at', 'created_by', 'updated_by']);

/** A long text deserves the full width of the form rather than a half column. */
const FULL_WIDTH_WIDGETS = new Set(['textarea', 'file', 'relations']);

export function resolveWidget(field) {
    if (field.choices && Object.keys(field.choices).length > 0) {
        return 'choice';
    }

    return FIELD_WIDGETS[String(field.type || '').toLowerCase()] || 'text';
}

/**
 * Builds an editable form from a model's server metadata.
 *
 * Where `useApiForm` writes the payload it is handed, this one derives the
 * fields themselves: what the model declares is what the form edits.
 *
 * `metadataStore.getMetadata()` is **async** — it fetches `/dataset/metadatas`
 * on first use. Reading it synchronously inside a computed yields a Promise,
 * which is silently falsy against `?.fields` and leaves the form with no fields
 * at all. Hence the ref and the explicit load.
 *
 * @param {string} modelName Model name as `/dataset/metadatas` reports it
 * @param {Object} options
 * @param {string} [options.prefix] API prefix, `/console` for the console
 * @param {Array<string>} [options.fields] Field order; defaults to metadata order
 * @param {Array<string>} [options.exclude] Extra fields to leave out
 * @param {Object} [options.defaults] Values a new record starts with — how a
 *   nested editor tells the form which parent it is creating under
 */
export function useApiModelForm(modelName, options = {}) {
    const metadataStore = useMetadataStore();
    const service = useApiModel(modelName, { prefix: options.prefix });

    const record = ref(null);
    const values = reactive({});
    const errors = ref({});
    const status = ref('idle');
    const error = ref(null);
    const metadata = ref(null);

    const loadMetadata = async () => {
        metadata.value = await metadataStore.getMetadata(modelName);

        return metadata.value;
    };

    const fields = computed(() => {
        const meta = metadata.value;

        if (!meta?.fields) {
            return [];
        }

        const excluded = new Set([...HIDDEN_FIELDS, ...(options.exclude || [])]);
        const names = options.fields || Object.keys(meta.fields);

        return names
            .filter((name) => !excluded.has(name) && meta.fields[name])
            .map((name) => {
                const field = meta.fields[name];
                const widget = resolveWidget(field);

                return {
                    name,
                    label: field.label || name,
                    widget,
                    required: field.required === true,
                    readonly: field.readonly === true,
                    choices: field.choices || null,
                    target: field.target || null,
                    fullWidth: FULL_WIDTH_WIDGETS.has(widget),
                    meta: field,
                };
            });
    });

    const seed = (source = null) => {
        for (const key of Object.keys(values)) {
            delete values[key];
        }

        const defaults = options.defaults || {};

        for (const field of fields.value) {
            const raw = source ? source[field.name] : defaults[field.name];

            if (Array.isArray(raw)) {
                values[field.name] = raw.map((item) =>
                    item && typeof item === 'object' && 'id' in item ? item.id : item
                );
            } else {
                values[field.name] = raw && typeof raw === 'object' && 'id' in raw ? raw.id : (raw ?? null);
            }
        }
    };

    const reset = (source = null) => {
        record.value = source;
        errors.value = {};
        seed(source);
    };

    // The field list only exists once the metadata has landed, so re-seed when it
    // does rather than leaving an empty form on screen.
    watch(fields, () => seed(record.value));

    const load = async (id) => {
        status.value = 'loading';
        error.value = null;

        try {
            await loadMetadata();
            const response = await service.get(id);

            reset(response?.data ?? response);
            status.value = 'success';
        } catch (caught) {
            error.value = caught;
            status.value = 'error';
        }

        return record.value;
    };

    const start = async () => {
        status.value = 'loading';
        error.value = null;

        try {
            await loadMetadata();
            reset(null);
            status.value = 'success';
        } catch (caught) {
            error.value = caught;
            status.value = 'error';
        }
    };

    const save = async () => {
        status.value = 'loading';
        error.value = null;
        errors.value = {};

        const payload = {};

        for (const field of fields.value) {
            if (!field.readonly) {
                payload[field.name] = values[field.name];
            }
        }

        try {
            const response = record.value?.id
                ? await service.update(record.value.id, payload)
                : await service.create(payload);
            const saved = response?.data ?? response;

            reset(saved);
            status.value = 'success';

            return saved;
        } catch (caught) {
            // FastAPI reports field errors as `detail: [{loc, msg}]`; surface them
            // next to their input rather than as one opaque banner.
            const details = caught?.details?.detail ?? caught?.response?.data?.detail;

            if (Array.isArray(details)) {
                errors.value = Object.fromEntries(
                    details.filter((item) => Array.isArray(item.loc)).map((item) => [item.loc.at(-1), item.msg])
                );
            }

            error.value = caught;
            status.value = 'error';

            throw caught;
        }
    };

    return { record, values, fields, errors, status, error, metadata, load, start, save, reset };
}
