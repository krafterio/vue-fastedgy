/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { computed, getCurrentScope, onScopeDispose, ref, shallowRef, toValue } from 'vue';
import { useApiModel } from './api.js';
import { useAuthStore } from '../stores/auth.js';
import { useMetadataStore } from '../stores/metadata.js';

/**
 * The width of a column that says none: it keeps its own.
 *
 * @type {number}
 */
export const defaultColumnWidth = 200;

/**
 * The widths a column offers, by their label.
 *
 * @type {Array<{ label: string, width: number }>}
 */
export const columnWidths = [
    { label: 'Compact', width: 120 },
    { label: 'Normal', width: defaultColumnWidth },
    { label: 'Large', width: 280 },
];

/**
 * The name the layout of a list is kept under: no menu of views lists it.
 */
const LAYOUT_NAME = 'List columns';

/**
 * The fields no column shows: the record itself, its search, its order, its owners.
 */
const HIDDEN_FIELDS = ['id', 'search_value', 'image', 'created_by', 'updated_by', 'workspace', 'sequence'];

/**
 * The types a column shows.
 */
const SHOWN_TYPES = [
    'char',
    'text',
    'rich_text',
    'url',
    'email',
    'phone',
    'integer',
    'float',
    'decimal',
    'boolean',
    'date',
    'datetime',
    'time',
    'choice',
    'many2one',
    'many2many',
];

/**
 * @typedef {Object} ColumnEntry
 * @property {string} name - The field of the column
 * @property {number|null} width - Its width, null for the default one
 */

/**
 * An entry as `display_fields` keeps it, read: a name, or a name and a width.
 *
 * @param {unknown} raw
 * @returns {ColumnEntry|null} - Null for what names no column
 */
export function readColumnEntry(raw) {
    if (typeof raw === 'string') {
        return raw ? { name: raw, width: null } : null;
    }

    if (raw === null || typeof raw !== 'object' || typeof raw.name !== 'string' || !raw.name) {
        return null;
    }

    const width = typeof raw.width === 'number' && raw.width !== defaultColumnWidth ? raw.width : null;

    return { name: raw.name, width };
}

/**
 * A column as `display_fields` keeps it: its name, or its name and its width
 * when it is not the default one.
 *
 * @param {string} name
 * @param {number|null} [width]
 * @returns {string|{ name: string, width: number }}
 */
export function columnEntry(name, width = null) {
    return width && width !== defaultColumnWidth ? { name, width } : name;
}

/**
 * The columns a list shows, their order and their width: those of the user,
 * else those of everyone, else the columns declared.
 *
 * A change shows at once and is written once the changes of a moment are over,
 * as a custom view without filters of the scope `layout` (`layout:<scope>`),
 * which no menu of views lists. On a view that carries its columns, a change is
 * one of the view instead. Given the list it lays out (`table`), its views save
 * and show the columns (`display_fields`), and a data table shows them.
 *
 * A `store` keeps the layout somewhere else, the columns of a record for one:
 * it reads and writes the entries as `display_fields` keeps them, and nothing
 * is shared.
 *
 * @param {string|object} model - Model name or an api model (useXxxApiModel())
 * @param {Object} [options]
 * @param {string} [options.scope] - The list among those of the model, `''` for its default one
 * @param {string} [options.prefix] - Where the custom views are read, where the api model answers otherwise
 * @param {Array<string|object>|Function|import('vue').Ref} [options.declared] - The columns shown when no layout says
 *   otherwise, as `display_fields` keeps them
 * @param {Array<string>} [options.locked] - The columns that move, but are neither removed nor resized; put back first
 *   when a layout leaves them out
 * @param {Array<string>} [options.exclude] - The fields never offered
 * @param {{ read: () => Promise<Array|null>, write: (entries: Array) => Promise<void> }} [options.store] - Where the
 *   layout is kept in place of the custom views
 * @param {number} [options.delay] - How long the changes of a moment wait before they are written (default: 500 ms)
 * @param {Object} [options.table] - The data iterator or data table the layout is for
 * @returns {Object}
 *
 * @example
 * const list = useDataIterator(useFlowApiModel(), { views: { scope: '' } });
 * const layout = useColumnLayout(useFlowApiModel(), {
 *     table: list,
 *     declared: ['status', 'due_date'],
 *     locked: ['name'],
 * });
 *
 * layout.show('priority');
 */
export function useColumnLayout(model, options = {}) {
    const { scope = '', store = null, delay = 500, table = null } = options;
    const modelName = typeof model === 'string' ? model : model.modelName;
    const prefix = options.prefix ?? (typeof model === 'string' ? '' : (model.prefix ?? ''));
    const views = useApiModel('custom_view', { prefix });
    const metadataStore = useMetadataStore();
    const authStore = useAuthStore();
    const layoutScope = scope ? `layout:${scope}` : 'layout';

    const locked = () => toValue(options.locked) ?? [];
    const exclude = () => toValue(options.exclude) ?? [];

    const meta = shallowRef(null);
    const own = ref(null);
    const shared = ref(null);
    const viewed = ref(null);
    const sharedEditable = ref(null);
    const loading = ref(false);
    const error = ref(null);

    let ownId = null;
    let sharedId = null;
    let pending = null;
    let writes = Promise.resolve();

    /**
     * Entries as `display_fields` keeps them, read: the locked columns put back
     * first, the fields gone from the metadata left out, unless declared.
     *
     * @param {unknown} raw
     * @returns {Array<ColumnEntry>|null}
     */
    const entriesOf = (raw) => {
        if (!Array.isArray(raw)) {
            return null;
        }

        const known = meta.value?.fields ?? null;
        const declared = new Set((toValue(options.declared) ?? []).map((one) => readColumnEntry(one)?.name));
        const entries = raw
            .map(readColumnEntry)
            .filter((entry) => entry && (!known || entry.name in known || declared.has(entry.name)));
        const names = new Set(entries.map((entry) => entry.name));

        return [
            ...locked()
                .filter((name) => !names.has(name))
                .map((name) => ({ name, width: null })),
            ...entries,
        ];
    };

    const entries = computed(
        () => viewed.value ?? own.value ?? shared.value ?? entriesOf(toValue(options.declared) ?? []) ?? []
    );

    const written = computed(() => entries.value.map((entry) => columnEntry(entry.name, entry.width)));

    const available = computed(() => {
        const shown = new Set(entries.value.map((entry) => entry.name));

        return Object.values(meta.value?.fields ?? {}).filter(
            (field) =>
                SHOWN_TYPES.includes(field.type) &&
                !HIDDEN_FIELDS.includes(field.name) &&
                !exclude().includes(field.name) &&
                !shown.has(field.name)
        );
    });

    /**
     * Run a write after those before it, its failure kept as the error.
     *
     * @param {() => Promise<void>} run
     * @returns {Promise<void>}
     */
    const write = (run) => {
        writes = writes.then(async () => {
            try {
                await run();
                error.value = null;
            } catch (failure) {
                error.value = failure;
            }
        });

        return writes;
    };

    /**
     * Write entries into a layout, created when there is none, and give its id.
     */
    const save = async (id, shown, user) => {
        const fields = shown.map((entry) => columnEntry(entry.name, entry.width));

        if (id) {
            await views.update(id, { display_fields: fields });

            return id;
        }

        const created = await views.create(
            { name: LAYOUT_NAME, model: modelName, scope: layoutScope, user, display_fields: fields },
            { fields: 'id' }
        );

        return created.data.id;
    };

    const flush = () => {
        pending = null;

        const shown = own.value;

        if (!shown) {
            return;
        }

        void write(async () => {
            if (store) {
                await store.write(shown.map((entry) => columnEntry(entry.name, entry.width)));
            } else {
                ownId = await save(ownId, shown, authStore.user?.id ?? null);
            }
        });
    };

    const change = (next) => {
        if (viewed.value) {
            viewed.value = next;

            return;
        }

        own.value = next;
        clearTimeout(pending);
        pending = setTimeout(flush, delay);
    };

    /**
     * Read the layout of the user, else the one of everyone, and the fields a
     * column can show; again in another workspace.
     *
     * @returns {Promise<void>}
     */
    const load = async () => {
        loading.value = true;

        try {
            meta.value = await metadataStore.getMetadata(modelName);

            if (store) {
                own.value = entriesOf(await store.read());
            } else {
                const response = await views.list({
                    size: 10,
                    fields: 'id,user,display_fields,editable',
                    filter: [
                        ['model', '=', modelName],
                        ['scope', '=', layoutScope],
                    ],
                });
                const found = response.data?.items ?? [];
                const mine = found.find((one) => one.user != null) ?? null;
                const everyone = found.find((one) => one.user == null) ?? null;

                ownId = mine?.id ?? null;
                own.value = entriesOf(mine?.display_fields);
                sharedId = everyone?.id ?? null;
                shared.value = entriesOf(everyone?.display_fields);
                sharedEditable.value = everyone?.editable ?? null;
            }

            error.value = null;
        } catch (failure) {
            error.value = failure;
        } finally {
            loading.value = false;
        }
    };

    const layout = {
        /** The columns shown, in their order: `{ name, width }`, width null for the default one */
        entries,

        /** The columns shown, as `display_fields` keeps them */
        written,

        /** The fields a column can be added for: those a column shows, but the technical, excluded and shown ones */
        available,

        /** Whether the layout of everyone can be written by the user */
        canShare: computed(() => !store && (sharedEditable.value ?? true)),

        loading,

        /** What the last read or write failed with */
        error,

        load,

        /** The first read of the layout, which the list it is for waits for */
        ready: null,

        /**
         * Show the columns of a view, none for null: the layout again.
         * @param {Array|null} fields - The `display_fields` of the view
         */
        applyView: (fields) => {
            viewed.value = entriesOf(fields);
        },

        /**
         * Add the column of a field, at an index or last.
         * @param {string} name
         * @param {{ at?: number }} [where]
         */
        show: (name, { at } = {}) => {
            if (entries.value.some((entry) => entry.name === name)) {
                return;
            }

            const next = [...entries.value];

            next.splice(Math.min(Math.max(at ?? next.length, 0), next.length), 0, { name, width: null });
            change(next);
        },

        /**
         * Remove the column of a field, unless it is locked.
         * @param {string} name
         */
        hide: (name) => {
            if (locked().includes(name)) {
                return;
            }

            change(entries.value.filter((entry) => entry.name !== name));
        },

        /**
         * Put the column of a field at an index.
         * @param {string} name
         * @param {number} index
         */
        move: (name, index) => {
            const next = [...entries.value];
            const at = next.findIndex((entry) => entry.name === name);

            if (at < 0) {
                return;
            }

            const [moved] = next.splice(at, 1);

            next.splice(Math.min(Math.max(index, 0), next.length), 0, moved);
            change(next);
        },

        /**
         * Give the column of a field a width, its own for null or the default one, unless it is locked.
         * @param {string} name
         * @param {number|null} width
         */
        resize: (name, width) => {
            if (locked().includes(name)) {
                return;
            }

            change(
                entries.value.map((entry) =>
                    entry.name === name ? { name, width: width && width !== defaultColumnWidth ? width : null } : entry
                )
            );
        },

        /**
         * Go back to the layout of everyone, else to the columns declared: the one of the user is forgotten, the one
         * of a view left. A store is given the columns declared.
         * @returns {Promise<void>}
         */
        reset: () => {
            clearTimeout(pending);
            pending = null;
            viewed.value = null;
            own.value = null;

            return write(async () => {
                if (store) {
                    await store.write(toValue(options.declared) ?? []);

                    return;
                }

                if (ownId) {
                    await views.delete(ownId);
                    ownId = null;
                }
            });
        },

        /**
         * Make the columns shown those of everyone without a layout of their own.
         * @returns {Promise<void>}
         */
        shareAsDefault: () => {
            const shown = [...entries.value];

            return write(async () => {
                sharedId = await save(sharedId, shown, null);
                shared.value = shown;
            });
        },
    };

    layout.ready = load();

    if (table?.layout) {
        table.layout.value = layout;
    }

    // A change of the last moment is written all the same.
    if (getCurrentScope()) {
        onScopeDispose(() => {
            if (pending) {
                clearTimeout(pending);
                flush();
            }

            if (table?.layout?.value === layout) {
                table.layout.value = null;
            }
        });
    }

    return layout;
}
