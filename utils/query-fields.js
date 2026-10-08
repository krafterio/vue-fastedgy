/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

const HIDDEN_FIELDS = ['id', 'search_value', 'created_by', 'updated_by', 'sequence'];

const HIDDEN_TYPES = ['computed', 'binary', 'point', 'fulltext'];

const RELATION_KINDS = {
    many2one: 'single',
    one2one: 'single',
    one_to_one: 'single',
    one2many: 'multiple',
    many2many: 'multiple',
};

/**
 * Whether a field leads to one related record, to several, or is no relation.
 *
 * @param {import('../stores/metadata.js').MetadataField|null|undefined} field
 * @returns {'single'|'multiple'|null}
 */
export function relationKindOf(field) {
    return (field && RELATION_KINDS[field.type]) || null;
}

/**
 * The fields a filter can be built on, in the order the metadata gives them.
 *
 * A field is offered when the server filters on it and it is not a technical
 * column: `id` is the record itself, and under a relation the relation itself.
 *
 * @param {import('../stores/metadata.js').MetadataModel|null|undefined} metadata
 * @param {{ exclude?: Array<string>, prefix?: string }} [options] - Paths left out, and the path of the level read
 * @returns {Array<import('../stores/metadata.js').MetadataField>}
 */
export function filterableFields(metadata, { exclude = [], prefix = '' } = {}) {
    if (!metadata?.fields) {
        return [];
    }

    return Object.values(metadata.fields).filter(
        (field) =>
            field.searchable !== false &&
            field.filter_operators?.length > 0 &&
            !HIDDEN_FIELDS.includes(field.name) &&
            !HIDDEN_TYPES.includes(field.type) &&
            !exclude.includes(prefix ? `${prefix}.${field.name}` : field.name)
    );
}

/**
 * Walk a path through the metadata: each field it crosses, the last one, and
 * the model it reaches. A relation and its key are one field, so `owner.id`
 * resolves as `owner`.
 *
 * @param {Record<string, import('../stores/metadata.js').MetadataModel>|null|undefined} metadatas
 * @param {string} model - The metadata name of the model the path starts from
 * @param {string} path
 * @returns {{ path: string, chain: Array<{ model: string, field: import('../stores/metadata.js').MetadataField }>, field: import('../stores/metadata.js').MetadataField, model: string, target: string|null }|null}
 */
export function resolveFieldPath(metadatas, model, path) {
    const names = String(path ?? '')
        .split('.')
        .filter(Boolean);
    const chain = [];
    let current = metadatas?.[model];

    for (const [index, name] of names.entries()) {
        const field = current?.fields?.[name];

        if (!field) {
            return null;
        }

        chain.push({ model: current.name, field });

        if (index < names.length - 1) {
            current = field.target ? metadatas?.[field.target] : null;
        }
    }

    if (chain.length > 1 && chain.at(-1).field.name === 'id' && relationKindOf(chain.at(-2).field)) {
        chain.pop();
    }

    const last = chain.at(-1);

    if (!last) {
        return null;
    }

    return {
        path: chain.map((link) => link.field.name).join('.'),
        chain,
        field: last.field,
        model: last.model,
        target: last.field.target ?? null,
    };
}

/**
 * The operators the server accepts on a field. A relation takes those of its
 * key as well: comparing a relation is comparing the key it holds.
 *
 * @param {Record<string, import('../stores/metadata.js').MetadataModel>|null|undefined} metadatas
 * @param {import('../stores/metadata.js').MetadataField|null|undefined} field
 * @returns {Array<string>}
 */
export function fieldOperators(metadatas, field) {
    const own = field?.filter_operators ?? [];

    if (!relationKindOf(field)) {
        return own;
    }

    const key = metadatas?.[field.target]?.fields?.id?.filter_operators ?? [];

    return [...new Set([...own, ...key])];
}
