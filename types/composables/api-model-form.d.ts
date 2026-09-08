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
export declare const FIELD_WIDGETS: {
    string: string;
    text: string;
    email: string;
    url: string;
    password: string;
    integer: string;
    biginteger: string;
    float: string;
    decimal: string;
    boolean: string;
    date: string;
    datetime: string;
    choice: string;
    char_choice: string;
    foreignkey: string;
    onetoone: string;
    manytomany: string;
    json: string;
    file: string;
    image: string;
};
export declare function resolveWidget(field: any): any;
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
export declare function useApiModelForm(modelName: string, options?: {
    prefix?: string;
    fields?: Array<string>;
    exclude?: Array<string>;
    defaults?: any;
}): {
    record: import("vue").Ref<null, null>;
    values: {};
    fields: import("vue").ComputedRef<{
        name: string;
        label: any;
        widget: any;
        required: boolean;
        readonly: boolean;
        choices: any;
        target: any;
        fullWidth: boolean;
        meta: any;
    }[]>;
    errors: import("vue").Ref<{}, {}>;
    status: import("vue").Ref<string, string>;
    error: import("vue").Ref<null, null>;
    metadata: import("vue").Ref<null, null>;
    load: (id: any) => Promise<null>;
    start: () => Promise<void>;
    save: () => Promise<any>;
    reset: (source?: null) => void;
};
//# sourceMappingURL=api-model-form.d.ts.map