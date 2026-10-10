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
export declare function useRecordEdit(model: string | object, options?: {
    list?: any;
    write?: (item: any, field: string, value: any) => Promise<Record<string, any> | null>;
    fields?: Array<string> | Function | import('vue').Ref<Array<string>>;
    onError?: (error: any) => void;
    params?: object;
}): {
    edit: Function;
    create: Function;
    isSaving: Function;
    errorOf: Function;
    rowErrorOf: Function;
};
//# sourceMappingURL=record-edit.d.ts.map