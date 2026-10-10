/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import {
    ref,
    reactive,
    readonly,
    computed,
    shallowRef,
    toValue,
    watch,
    nextTick,
    getCurrentScope,
    onScopeDispose,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApiModel } from './api.js';
import { useDataset } from './dataset.js';
import { formatOrderBy, orderByTerm, parseOrderBy } from '../utils/order-by.js';
import { usePageSize } from './page-size.js';
import { useSelection } from './selection.js';
import { useSortable } from './sortable.js';
import { useMetadataStore } from '../stores/metadata.js';
import { useOpeningView } from './custom-views.js';
import { quickFilterOf, readQuickFilters, writeQuickFilters } from './quick-filter.js';
import { sameExpression } from '../utils/query-expression.js';
import { isGroupable } from '../utils/query-fields.js';
import { t } from '../utils/i18n.js';
import { bus } from './bus.js';
import { RESOURCES_STALE } from './realtime.js';
import { RESOURCE_CHANGED, realtime } from '../network/realtime.js';

/**
 * The records of an axis made of a relation, read a page at a time.
 */
const AXIS_LIMIT = 50;

/**
 * How long a burst of writes on the records of an axis waits before the axis is read again.
 */
const AXIS_DELAY = 250;

/**
 * The fields a record of an axis is named by, most specific first, the ones flutter_fastedgy names it by.
 */
const LABEL_FIELDS = ['display_name', 'name', 'label', 'title', 'reference', 'email', 'code'];

/**
 * Read the expression a URL carries, `null` when it carries none or one that does not read.
 *
 * @param {unknown} value
 * @returns {any}
 */
function readExpression(value) {
    if (typeof value !== 'string' || value === '') {
        return null;
    }

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function readId(value) {
    const id = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;

    return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * @param {unknown} rule
 * @returns {boolean}
 */
const isEmptyRule = (rule) => rule == null || (Array.isArray(rule) && rule.length === 0);

/**
 * @param {string|number|null|undefined} one
 * @param {string|number|null|undefined} other
 * @returns {boolean}
 */
const sameId = (one, other) => one != null && other != null && String(one) === String(other);

// The keys of every list of a page go through one queue per router: two lists
// writing in the same tick would each replace a query the other has not landed.
const queues = new WeakMap();

/**
 * Write keys in the query of the current route, with those of every list of the
 * page written in the same tick, in one replace.
 *
 * @param {object} router
 * @param {{ query: Record<string, any> }} route
 * @param {Record<string, unknown>} patch - The keys to write, `null` or `''` removing one
 */
function queueQuery(router, route, patch) {
    let pending = queues.get(router);

    if (!pending) {
        pending = {};
        queues.set(router, pending);

        queueMicrotask(() => {
            queues.delete(router);

            const query = { ...route.query };

            for (const [key, value] of Object.entries(pending)) {
                if (value == null || value === '') {
                    delete query[key];
                } else {
                    query[key] = String(value);
                }
            }

            // A replace is a navigation even when it changes nothing, and it
            // cancels the one the screen has going on (to another workspace).
            if (JSON.stringify(query) !== JSON.stringify(route.query)) {
                void router.replace({ query });
            }
        });
    }

    Object.assign(pending, patch);
}

/**
 * Default configuration values for data iteration
 */
const DEFAULT_OPTIONS = {
    pageSize: 50,
    availablePageSizes: [25, 50, 100],
    prefix: '',
    headers: null,
    pageSizeKey: null,
    enableSelection: false,
    orderable: true,
    append: false,
    searchField: 'search_value',
    scrollTarget: null,
    url: true,
    rowLimit: 20,
    groupFields: [],
    emptyGroup: 'last',
};

/**
 * Core composable for data iteration with server-side pagination, filters, and sorting
 * Used as base for DataTable and DataGrid
 *
 * @param {string|object} model - Model name (e.g., 'retail_chains', 'tasks') or an api model (useXxxApiModel())
 * @param {Object} options - Configuration options
 * @param {Array<string>} options.fields - Fields read by the caller (e.g. ['name', 'type.name'])
 * @param {Function|Array} options.fieldsResolver - Function that returns fields array or static array
 * @param {number} options.pageSize - Default items per page (overrides default: 50)
 * @param {Array} options.availablePageSizes - Available page sizes (overrides default: [25, 50, 100])
 * @param {Array<string>} options.defaultOrderBy - Default sort ['field:asc', 'field2:desc']
 * @param {Array<string>} options.exportFields - Fields to export
 * @param {Array|Function} options.filter - Restrictive filters to always apply
 * @param {string} options.prefix - Prefix for the API (default: "")
 * @param {Object} options.headers - Custom headers for API requests (default: null)
 * @param {boolean} options.sortable - Enable drag & drop sorting
 * @param {boolean} options.orderable - Enable column sorting (default: true)
 * @param {boolean} options.enableSelection - Enable row selection (default: false)
 * @param {boolean} options.append - Keep the loaded items and append the next pages (default: false)
 * @param {string} options.searchField - Fulltext field the `search` text is matched on (default: 'search_value')
 * @param {Array<string>|Function|import('vue').Ref<Array<string>>} options.searchFields - Fields the `search` text is
 *   looked for in instead, a record matching on any of them (`icontains`); a getter or a ref is read again as it
 *   changes
 * @param {HTMLElement|Window|import('vue').Ref|Function} options.scrollTarget - Element that scrolls the list, whose
 *   position is kept in the URL (`sl`) and restored on entry; nothing is kept when absent
 * @param {string} options.datasetPrefix - Where the `/dataset/*` routes answer: by default where the api model does
 *   (its prefix, else `options.prefix`), `''` for the root
 * @param {string} options.pageSizeKey - Where the page size is remembered, nowhere when absent
 * @param {boolean|{ prefix?: string }} options.url - Keep the state of the list in the URL (default: true), its keys
 *   after `prefix` when one is given (`done_p`, `done_q`…, the keys of `views.state` included), so that two lists of
 *   one screen keep theirs apart; false holds it in memory, for a list drawn inside a screen whose URL says something
 *   else (a tab of a record shown over another list)
 * @param {boolean|Function|import('vue').Ref<boolean>} options.enabled - Whether the list reads at all; the first
 *   page waits for it, so a screen still resolving its fields or filter does not read the list more than once
 *   (default: true)
 * @param {Array<import('./quick-filter.js').QuickFilter|object>} options.quickFilters - Values shown by the controls of
 *   the screen (their definitions, or the components `defineQuickFilter` makes), held in `quick`, kept in the URL as
 *   `qf` when away from their default, their rules combined with the rest of the filter
 * @param {boolean|{ scope?: string, prefix?: string, state?: Record<string, ViewStateField> }} options.views - Open on
 *   the custom view the list starts from, applied before the first page, the views being read under `prefix`, else
 *   under the prefix of the api model, else under `options.prefix`: the one a link names (`cv`), else, for a URL
 *   saying nothing of the list, the favorite of the user, else the one of everyone. The filters of the view stay out
 *   of the URL, which says only those that moved away from it. A view also holds the grouping of the list
 *   (`group_by`) and, for a list whose users choose its columns, those columns (`display_fields`). `state` names what
 *   a view holds besides, by field of the view: applied on opening unless the URL says it under its `key`, applied and
 *   saved with the view by `useCustomViews`. A screen that keeps `group_by` in `state` keeps the grouping its own
 * @param {string} options.groupBy - The field the rows are grouped by when nothing else says it, none for a flat list:
 *   a field with choices, a boolean or a single relation. The grouping is kept in the URL as `g` when it is not this
 *   one, `none` for a flat list then. Each group reads its own rows, a page at a time
 * @param {number} options.rowLimit - The rows of a page of a group (default: 20)
 * @param {Array<string>} options.groupFields - More fields read on the records of an axis made of a relation
 * @param {(group: DataGroup) => any} options.groupFilter - A rule added to the filter of one group, from what its axis
 *   says of it (its `value`, its `record`), null for none
 * @param {'last'|'first'|'none'|((field: string) => 'last'|'first'|'none')} options.emptyGroup - Where the group of
 *   the rows with no value stands (default: last), or what says it for the field grouped by; a required field has none
 * @param {Record<string, any>|Function|import('vue').Ref<Record<string, any>>} options.relationScopes - The rule
 *   narrowing the records an axis made of a relation shows, by field
 * @param {(field: string, value: any) => any} options.colorOf - The color of the group of a value on an axis of
 *   choices, null to leave it to the screen
 * @param {import('vue').ShallowRef<any>} options.layout - Where the column layout of the list is held, which
 *   `useColumnLayout` fills when it is given the list: a view then saves and shows its columns
 * @returns {Object} - DataIterator state and methods
 */
/**
 * @typedef {Object} ViewStateField
 * @property {() => any} get - What the list holds now
 * @property {(value: any) => void} set - Hold what a view says, null when it says nothing
 * @property {string} [key] - The URL key the application keeps it under
 */
/**
 * A group of a grouped list: what its axis says of it, its rows and their pages.
 *
 * @typedef {Object} DataGroup
 * @property {string} key - Stable across the pages of the axis: `value:<value>`, `id:<id>` or `empty`
 * @property {string} label
 * @property {any} color
 * @property {any} value - The value of the field its rows hold, null for the group of the rows with none
 * @property {Record<string, any>|null} record - The record of a relation it stands for, read with the fields of the
 *   axis
 * @property {Array} predicate - The rule that delimits it
 * @property {any} filter - The filter its rows are read with: the one of the list, its rule and the one the list adds
 * @property {boolean} isEmptyBucket - Whether it holds the rows with no value
 * @property {Array<Object>} items
 * @property {number} total
 * @property {number} page - The last page its rows hold
 * @property {number} totalPages
 * @property {boolean} hasMore - Whether rows remain after those it holds
 * @property {boolean} loading
 * @property {any} error
 * @property {(page: number) => Promise<void>} setPage - Show a page of its rows
 * @property {() => Promise<void>} loadMore - Add the next page to its rows
 */

export function useDataIterator(model, options = {}) {
    const config = { ...DEFAULT_OPTIONS, ...options };
    const modelName = typeof model === 'string' ? model : model.modelName;
    const service =
        typeof model === 'string'
            ? useApiModel(model, {
                  prefix: options.prefix || DEFAULT_OPTIONS.prefix,
                  headers: options.headers || DEFAULT_OPTIONS.headers,
              })
            : model;
    const metadataStore = useMetadataStore();
    const route = useRoute();
    const router = useRouter();

    // A list drawn inside another screen leaves the URL to that screen. Two
    // lists of one screen keep their keys apart, each after its own prefix.
    const urlPrefix = config.url !== null && typeof config.url === 'object' ? (config.url.prefix ?? '') : '';

    // The query of the route as this list reads it: its own keys, without their prefix.
    const urlQuery = () => {
        if (config.url === false) {
            return {};
        }

        if (!urlPrefix) {
            return route.query;
        }

        return Object.fromEntries(
            Object.entries(route.query)
                .filter(([key]) => key.startsWith(urlPrefix))
                .map(([key, value]) => [key.slice(urlPrefix.length), value])
        );
    };
    const entry = urlQuery();

    // The rows of a flat list; a grouped one holds them in its groups.
    const rows = ref([]);
    const count = ref(0);
    const reading = ref(false);
    const failure = ref(null);
    const resequencing = ref(false);
    const loaded = ref(false);

    // Several watchers answer to the same change (a search resets the page),
    // and each replace would start from a query the previous one has not
    // landed yet: their keys are written together, with those of the other
    // lists of the page.
    // While the list takes a whole state at once (a URL changed from outside, a
    // workspace switch), its watchers neither write the URL nor read: one read
    // follows. The URL changed from outside already says what the list holds.
    let settling = false;

    // The values each key was written with and the route has not shown yet: the
    // list knows its own writes when they land, late or not.
    const sent = new Map();

    const writeQuery = (patch) => {
        if (config.url === false || settling) {
            return;
        }

        const shown = urlQuery();

        for (const [key, value] of Object.entries(patch)) {
            const text = value == null || value === '' ? null : String(value);

            if (text !== (shown[key] ?? null)) {
                sent.set(key, [...(sent.get(key) ?? []), text]);
            }
        }

        queueQuery(
            router,
            route,
            Object.fromEntries(Object.entries(patch).map(([key, value]) => [urlPrefix + key, value]))
        );
    };

    const initialPage = entry.p ? parseInt(entry.p, 10) : 1;
    const currentPage = ref(initialPage > 0 ? initialPage : 1);

    // The first page the rows hold, the last one being the current page: in a
    // list that pages, the current one, until loadMore adds the next ones; in an
    // appended list, the first, so that a list entered at page n reads its pages
    // 1 to n in one request and the rows the scroll position points at are there.
    let firstHeld = config.append ? 1 : currentPage.value;

    const initialScroll = entry.sl ? parseInt(entry.sl, 10) : 0;
    let restoreScroll = config.scrollTarget && initialScroll > 0 ? initialScroll : null;

    const pageSize = usePageSize(entry.s, config.availablePageSizes, config.pageSize, config.pageSizeKey);

    const customFilter = ref(null);

    // What a query builder sets, kept in the URL as `f`, and the custom view the
    // list is on, as `cv`: a link opens the list it was copied from. The filters
    // of the view are its own to say (`undefined` while they are not read), so
    // `f` says only those that moved away from them.
    const expression = ref(readExpression(entry.f));
    const view = ref(readId(entry.cv));
    const viewExpression = ref(undefined);

    const quickFilters = (config.quickFilters ?? []).map(quickFilterOf);
    const quick = reactive(readQuickFilters(entry.qf, quickFilters));

    const search = ref(typeof entry.q === 'string' ? entry.q : '');
    const appliedSearch = ref(search.value.trim());

    const searchRule = (text) => {
        const fields = toValue(config.searchFields);

        if (!Array.isArray(fields) || fields.length === 0) {
            return [config.searchField, 'search_fuzzy', text];
        }

        const rules = fields.map((field) => [field, 'icontains', text]);

        return rules.length > 1 ? ['|', rules] : rules[0];
    };

    // What narrows the list beyond its restrictive filter: the filter the screen
    // sets, the expression, the quick filters and the search.
    const extraRules = computed(() =>
        [
            customFilter.value,
            expression.value,
            ...quickFilters.map((one) => one.filter(quick[one.name])),
            appliedSearch.value ? searchRule(appliedSearch.value) : null,
        ].filter(Boolean)
    );

    const filter = computed(() => {
        const restrictiveFilters = typeof config.filter === 'function' ? config.filter() || [] : config.filter || [];

        if (extraRules.value.length === 0) {
            return restrictiveFilters.length > 0 ? restrictiveFilters : null;
        }

        const restrictiveRules = restrictiveFilters.every((rule) => Array.isArray(rule))
            ? restrictiveFilters
            : [restrictiveFilters];

        return [...restrictiveRules, ...extraRules.value];
    });

    const metadata = metadataStore.getMetadata(modelName);

    // What the metadata say of the model besides its manual order: the fields
    // that group, and whether a row can change of group.
    const modelMeta = shallowRef(null);

    const readModel = (next) =>
        Promise.resolve(next).then(
            (read) => {
                modelMeta.value = read ?? null;
            },
            () => {
                modelMeta.value = null;
            }
        );

    const modelReady = readModel(metadata);

    // The dataset routes answer where the model does, unless the screen says otherwise ('' for the root).
    const datasetPrefix = config.datasetPrefix ?? service.prefix ?? config.prefix;

    const {
        isSortable: sortableModel,
        sortableField,
        resequence,
        readMetadata,
        ready: sortableReady,
    } = useSortable(modelName, metadata, config.sortable, { prefix: datasetPrefix });

    // A manual order only means something over the whole list: numbering the
    // rows a search or a filter leaves would mix their ranks with the others'.
    // The restrictive filter fixes the list, and does not count.
    const isSortable = computed(() => sortableModel.value && extraRules.value.length === 0);

    const fields = computed(() => {
        let baseFields = [];

        const resolver = config.fieldsResolver ?? config.fields;

        if (typeof resolver === 'function') {
            baseFields = resolver();
        } else if (Array.isArray(resolver)) {
            baseFields = resolver;
        }

        const allFields = ['id', ...baseFields];

        if (sortableModel.value && sortableField.value && !allFields.includes(sortableField.value)) {
            allFields.push(sortableField.value);
        }

        return [...new Set(allFields)];
    });

    const initialOrderBy = parseOrderBy(entry.order_by) ?? config.defaultOrderBy ?? null;
    const orderBy = ref(initialOrderBy);

    // The rows grouped by the values of a field, kept in the URL as `g` when it
    // is not the field of the option, `none` for a flat list then.
    const defaultGroupBy = config.groupBy ?? null;

    /**
     * The grouping a URL or a view says: the one of the option when it says
     * nothing, none for `none`.
     *
     * @param {string|null|undefined} said
     * @returns {string|null}
     */
    const groupByOf = (said) =>
        said === null || said === undefined || said === '' ? defaultGroupBy : said === 'none' ? null : said;

    const groupBy = ref(groupByOf(typeof entry.g === 'string' ? entry.g : null));
    const rowLimit = config.rowLimit ?? DEFAULT_OPTIONS.rowLimit;
    const groups = shallowRef([]);
    const axisState = reactive({ page: 1, totalPages: 0, loading: false, error: null, sequenceField: null });
    const groupError = ref(null);

    // The axis the groups are laid out on, for the field the groups were read by.
    let axis = null;
    let groupedBy = null;
    let axisReads = 0;

    // The column layout of a list whose users choose its columns.
    const layout = config.layout ?? shallowRef(null);
    const displayFields = computed(() => layout.value?.written?.value ?? null);

    const items = computed({
        get: () => (groupBy.value ? groups.value.flatMap((group) => group.items) : rows.value),
        set: (value) => {
            rows.value = value;
        },
    });

    const total = computed({
        get: () => (groupBy.value ? groups.value.reduce((sum, group) => sum + group.total, 0) : count.value),
        set: (value) => {
            count.value = value;
        },
    });

    const loading = computed(() =>
        groupBy.value
            ? axisState.loading || resequencing.value || groups.value.some((group) => group.loading)
            : reading.value || resequencing.value
    );

    const error = computed(() => (groupBy.value ? (groupError.value ?? axisState.error) : failure.value));

    // A list keeping custom views reads its first page once, already on the
    // view it starts from: the one its link names when the link carries no
    // filter of its own, else the favorite when the URL says nothing of the
    // list. The watchers answering to the view run while the list is held back.
    const viewState = (typeof config.views === 'object' && config.views?.state) || {};
    const stateKeys = Object.values(viewState)
        .map((one) => one.key)
        .filter(Boolean);

    // A screen that keeps the grouping of its views in its own state keeps it.
    const keepsGrouping = !('group_by' in viewState);

    /**
     * Show what a view holds besides its filters, its order and its grouping:
     * what the screen keeps in it, unless the query says it under its key, and
     * the columns of a list whose users choose them.
     *
     * @param {Record<string, any>|null} shown - The custom view, null for none
     * @param {Record<string, any>} [query] - The URL keys of the list, without their prefix
     */
    const applyView = (shown, query = {}) => {
        for (const [name, one] of Object.entries(viewState)) {
            if (!(one.key && one.key in query)) {
                one.set(shown?.[name] ?? null);
            }
        }

        layout.value?.applyView(shown?.display_fields ?? null);
    };

    const linkedView = 'f' in entry ? null : view.value;
    const entered = ['p', 's', 'order_by', 'q', 'sl', 'f', 'cv', 'qf', 'g', ...stateKeys].some((key) => key in entry);
    // The views answer where the model does, unless the screen says otherwise.
    const viewsPrefix = config.views ? (config.views.prefix ?? service.prefix ?? config.prefix) : config.prefix;
    const opening =
        config.views && (linkedView !== null || !entered)
            ? useOpeningView(modelName, { scope: config.views.scope, prefix: viewsPrefix, id: linkedView })
            : null;
    const opened = ref(opening === null);

    void opening?.promise.then(async () => {
        const start = opening.view.value;

        if (start) {
            const query = urlQuery();

            expression.value = start.filters ?? null;
            viewExpression.value = start.filters ?? null;
            view.value = start.id;

            if (!('order_by' in query)) {
                orderBy.value = start.order_by ?? config.defaultOrderBy ?? null;
            }

            if (keepsGrouping && !('g' in query)) {
                groupBy.value = groupByOf(start.group_by);
            }

            applyView(start, query);

            await nextTick();
        } else {
            view.value = null;
        }

        opened.value = true;
    });

    /**
     * Fetch items from API with current filters, pagination, and sorting
     */
    const enabled = () => toValue(config.enabled) !== false && opened.value;

    // Only the latest read lands: an earlier one answering last would put back
    // the rows of a filter or a field list the screen has already left.
    let latest = 0;

    // What the last read asked for: a screen settles its fields as its metadata
    // arrives, and the read that goes out then already carries them.
    let readFields = null;

    // Several pages read at once start from the first one, or say their offset
    // when a list that pages added some to the page it was on.
    const readWindow = (from, pages, size = pageSize.value) =>
        from === 1 || pages === 1
            ? { page: pages > 1 ? 1 : from, size: size * pages }
            : { offset: (from - 1) * size, limit: size * pages };

    const restore = () => {
        if (restoreScroll !== null) {
            const top = restoreScroll;

            restoreScroll = null;
            void nextTick(() => scrollElement()?.scrollTo({ top }));
        }
    };

    // What a group keeps to itself: the first page its rows hold, and its latest read.
    const holds = new WeakMap();

    // The filter of the rows of a group: the one the list sends, the rule of
    // the group, and what the screen adds for it.
    const filterOf = (group) => {
        const rules = [filter.value, group.predicate, config.groupFilter?.(group) ?? null].filter(
            (rule) => !isEmptyRule(rule)
        );

        return rules.length === 1 ? rules[0] : ['&', rules];
    };

    /**
     * Read the rows of a group: a page of them (`page`), the next one added to
     * them (`more`), or again every page they hold (`held`). Only the latest
     * read of a group lands, and its rows stay while it reads.
     *
     * @param {DataGroup} group
     * @param {'page'|'more'|'held'} mode
     * @param {number} [page]
     */
    const readRows = async (group, mode, page = 1) => {
        const held = holds.get(group);
        const run = ++held.latest;
        const from = mode === 'page' ? page : mode === 'more' ? group.page + 1 : held.first;
        const to = mode === 'held' ? group.page : from;

        group.loading = true;

        try {
            const result = await service.list({
                ...readWindow(from, to - from + 1, rowLimit),
                fields: fields.value,
                filter: filterOf(group),
                orderBy: orderBy.value,
            });

            if (run !== held.latest) {
                return;
            }

            const read = result.data.items;

            if (mode === 'more') {
                const shown = new Set(group.items.map((row) => row.id));

                group.items = [...group.items, ...read.filter((row) => !shown.has(row.id))];
            } else {
                group.items = read;
                held.first = from;
            }

            group.page = to;
            group.total = result.data.total;
            group.error = null;
        } catch (cause) {
            if (run === held.latest) {
                group.error = cause;
            }
        } finally {
            if (run === held.latest) {
                group.loading = false;
            }
        }
    };

    /**
     * @param {Object} bucket - What the axis says of the group
     * @returns {DataGroup}
     */
    const createGroup = (bucket) => {
        const group = reactive({
            ...bucket,
            items: [],
            total: 0,
            page: 1,
            loading: false,
            error: null,
            get filter() {
                return filterOf(group);
            },
            get totalPages() {
                return Math.ceil(group.total / rowLimit);
            },
            get hasMore() {
                return (holds.get(group).first - 1) * rowLimit + group.items.length < group.total;
            },
            setPage: (page) => readRows(group, 'page', page),
            loadMore: () => (group.loading || !group.hasMore ? Promise.resolve() : readRows(group, 'more')),
        });

        holds.set(group, { first: 1, latest: 0 });

        return group;
    };

    /**
     * The axis of the groups by a field, null for a field that does not group:
     * its choices, or yes and no, which cost no request, or the records of the
     * model a relation leads to, in its own order, a page at a time.
     *
     * @param {string} field
     * @returns {Promise<{ target: string|null, sequenceField: string|null,
     *   read: (page: number) => Promise<{ buckets: Array<Object>, totalPages: number }> }|null>}
     */
    const resolveAxis = async (field) => {
        const info = (await Promise.resolve(metadataStore.getMetadata(modelName)).catch(() => null))?.fields?.[field];

        if (!isGroupable(info)) {
            return null;
        }

        const place =
            typeof config.emptyGroup === 'function' ? config.emptyGroup(field) : (config.emptyGroup ?? 'last');
        const withEmpty = place !== 'none' && !info.required;
        const first = place === 'first';
        const empty = {
            key: 'empty',
            label: t('No value'),
            value: null,
            record: null,
            color: null,
            predicate: [field, 'is empty'],
            isEmptyBucket: true,
        };
        const bucket = (key, value, label, { color = null, record = null, predicate = [field, '=', value] } = {}) => ({
            key,
            label,
            value,
            record,
            color,
            predicate,
            isEmptyBucket: false,
        });
        const choices = Object.entries(info.choices ?? {});

        if (choices.length > 0 || info.type === 'boolean') {
            const values =
                choices.length > 0
                    ? choices.map(([value, label]) =>
                          bucket(`value:${value}`, value, label, { color: config.colorOf?.(field, value) ?? null })
                      )
                    : [
                          bucket('value:true', true, t('Yes'), { predicate: [field, 'is true'] }),
                          bucket('value:false', false, t('No'), { predicate: [field, 'is false'] }),
                      ];
            // A boolean filters on true and false alone: it has no group of rows with no value.
            const all = choices.length > 0 && withEmpty ? (first ? [empty, ...values] : [...values, empty]) : values;

            return {
                target: null,
                sequenceField: null,
                read: async (page) => ({
                    buckets: all.slice((page - 1) * AXIS_LIMIT, page * AXIS_LIMIT),
                    totalPages: Math.max(1, Math.ceil(all.length / AXIS_LIMIT)),
                }),
            };
        }

        const target = await Promise.resolve(metadataStore.getMetadata(info.target)).catch(() => null);
        const labelField = LABEL_FIELDS.find((name) => target?.fields?.[name]) ?? (target ? 'id' : 'name');
        const colorField = target?.fields?.color ? 'color' : null;
        const records = useApiModel(info.target, { prefix: service.prefix ?? config.prefix });
        const read = [
            ...new Set(['id', labelField, ...(colorField ? [colorField] : []), ...(config.groupFields ?? [])]),
        ];

        return {
            target: info.target,
            sequenceField: target?.sortable ? target.sortable_field || 'sequence' : null,
            read: async (page) => {
                const scope = toValue(config.relationScopes)?.[field] ?? null;
                const response = await records.list({
                    page,
                    size: AXIS_LIMIT,
                    fields: read,
                    ...(isEmptyRule(scope) ? {} : { filter: scope }),
                });
                const totalPages = Math.max(1, Math.ceil(response.data.total / AXIS_LIMIT));

                // The group of the rows with no value is no record of the
                // target: it opens the first page of the axis, or closes the last.
                return {
                    buckets: [
                        ...(withEmpty && first && page <= 1 ? [empty] : []),
                        ...response.data.items.map((record) =>
                            bucket(`id:${record.id}`, record.id, record[labelField] ?? `#${record.id}`, {
                                color: colorField ? (record[colorField] ?? null) : null,
                                record,
                            })
                        ),
                        ...(withEmpty && !first && page >= totalPages ? [empty] : []),
                    ],
                    totalPages,
                };
            },
        };
    };

    /**
     * Read a page of the axis and lay the groups out on it: a group that stays
     * keeps its rows (reading them again on a refresh), a new one reads its
     * first page, one that left goes.
     *
     * @param {number} run - The read it belongs to, dropped when a newer one started
     * @param {number} page
     * @param {'first'|'page'|'held'} mode
     */
    const readAxis = async (run, page, mode) => {
        axisReads += 1;
        axisState.loading = true;

        try {
            const read = await axis.read(page);

            if (run !== latest) {
                return;
            }

            const previous = new Map(groups.value.map((group) => [group.key, group]));
            const changed = new Set();
            const next = read.buckets.map((bucket) => {
                const kept = previous.get(bucket.key);

                if (kept) {
                    const before = JSON.stringify(filterOf(kept));

                    Object.assign(kept, bucket);

                    // The rule groupFilter adds may follow the record of the group.
                    if (JSON.stringify(filterOf(kept)) !== before) {
                        changed.add(kept);
                    }

                    return kept;
                }

                return createGroup(bucket);
            });

            axisState.page = page;
            axisState.totalPages = read.totalPages;
            axisState.error = null;
            groups.value = next;

            await Promise.all(
                next.map((group) => {
                    if (mode === 'first' || !previous.has(group.key) || changed.has(group)) {
                        return readRows(group, 'page', 1);
                    }

                    return mode === 'held' ? readRows(group, 'held') : null;
                })
            );
        } catch (cause) {
            if (run === latest) {
                axisState.error = cause;
            }
        } finally {
            axisReads -= 1;
            axisState.loading = axisReads > 0;
        }
    };

    // The records of an axis made of a relation are followed: what is written
    // on them is read again, a burst of writes at once.
    let following = null;

    const reloadAxis = () => (axis ? readAxis(latest, axisState.page, 'page') : Promise.resolve());

    const follow = (target) => {
        if (following?.target === target) {
            return;
        }

        following?.stop();
        following = null;

        if (!target) {
            return;
        }

        let timer = null;

        const onChanged = (event) => {
            if (event.detail?.model === target) {
                clearTimeout(timer);
                timer = setTimeout(() => void reloadAxis(), AXIS_DELAY);
            }
        };

        bus.addEventListener(RESOURCE_CHANGED, onChanged);
        realtime.subscribe(target);

        following = {
            target,
            stop: () => {
                clearTimeout(timer);
                bus.removeEventListener(RESOURCE_CHANGED, onChanged);
                realtime.unsubscribe(target);
            },
        };
    };

    const dropGroups = () => {
        follow(null);
        axis = null;
        groupedBy = null;
        groups.value = [];
        groupError.value = null;
        Object.assign(axisState, { page: 1, totalPages: 0, error: null, sequenceField: null });
    };

    /**
     * Read the groups by a field: their axis and their first rows the first
     * time, the axis and the rows each group holds again on a refresh, every
     * group from its first page after a change of the query.
     *
     * @param {number} run
     * @param {string} field
     * @param {'page'|'more'|'held'} mode
     */
    const readGroups = async (run, field, mode) => {
        if (axis && mode !== 'held' && !axisState.error) {
            await Promise.all(groups.value.map((group) => readRows(group, 'page', 1)));

            return;
        }

        const resolved = await resolveAxis(field);

        if (run !== latest) {
            return;
        }

        if (!resolved) {
            groupError.value = t("This field can't be grouped.");

            return;
        }

        const kept = axis !== null;

        groupError.value = null;
        axis = resolved;
        axisState.sequenceField = resolved.sequenceField;
        follow(resolved.target);

        await readAxis(run, kept ? axisState.page : 1, kept ? 'held' : 'first');
    };

    /**
     * Read the rows: the current page (with the pages before it in an appended
     * list), the next page added to the rows (`more`), or again every page the
     * rows hold (`held`); in a grouped list, the groups
     *
     * @param {'page'|'more'|'held'} [mode]
     */
    const fetchItems = async (mode = 'page') => {
        if (!enabled()) {
            return;
        }

        const run = ++latest;
        const field = groupBy.value;

        readFields = new Set(fields.value);

        // Another shape, flat or grouped by another field: what is held goes,
        // and the screen waits for the first rows of the new one.
        if (field !== groupedBy) {
            dropGroups();
            rows.value = [];
            count.value = 0;
            failure.value = null;
            groupedBy = field;
            loaded.value = false;
        }

        if (field) {
            await readGroups(run, field, mode);

            if (run === latest) {
                loaded.value = true;
                restore();
            }

            return;
        }

        if (mode === 'page' && !config.append) {
            firstHeld = currentPage.value;
        }

        const from = mode === 'more' ? currentPage.value : firstHeld;

        try {
            reading.value = true;
            failure.value = null;

            const result = await service.list({
                ...readWindow(from, currentPage.value - from + 1),
                fields: fields.value,
                filter: filter.value,
                orderBy: orderBy.value,
            });

            if (run !== latest) {
                return;
            }

            rows.value = mode === 'more' ? [...rows.value, ...result.data.items] : result.data.items;
            count.value = result.data.total;
            restore();
        } catch (err) {
            if (run === latest) {
                failure.value = err;
            }
        } finally {
            if (run === latest) {
                reading.value = false;
                loaded.value = true;
            }
        }
    };

    // The watchers answering to one change of the screen (a view applied sets
    // its filters and its order at once) read once, after them all: the page,
    // which carries the new fields too, before the rows held.
    let queued = null;
    let queuedMode = null;

    const queueRead = (mode) => {
        if (queuedMode !== 'page') {
            queuedMode = mode;
        }

        queued ??= Promise.resolve().then(() => {
            const next = queuedMode;

            queued = null;
            queuedMode = null;

            return fetchItems(next);
        });

        return queued;
    };

    /**
     * Toggle sort direction for a field: ascending, descending, then back to the default order
     * @param {string} field - Field to sort by
     */
    const toggleSort = (field) => {
        if (!field) return;

        if (config.orderable === false) return;

        const current = orderByTerm(orderBy.value?.[0] ?? '');

        if (current.field !== field) {
            orderBy.value = [`${field}:asc`];
        } else if (current.direction !== 'desc') {
            orderBy.value = [`${field}:desc`];
        } else {
            const byDefault = config.defaultOrderBy ?? null;

            // A default order on this very column would leave the click without effect: it turns around instead.
            orderBy.value = orderByTerm(byDefault?.[0] ?? '').field === field ? [`${field}:asc`] : byDefault;
        }
    };

    /**
     * Get current sort state for a field, a term written without a direction being ascending
     * @param {string} field - Field name
     * @returns {'asc' | 'desc' | null}
     */
    const getSortDirection = (field) => {
        const term = (orderBy.value ?? []).map(orderByTerm).find((one) => one.field === field);

        return term ? /** @type {'asc' | 'desc'} */ (term.direction) : null;
    };

    // The writes of the list running, a move or a cell saved: a refresh asked
    // meanwhile waits for them to end rather than reading what they have not
    // written yet, and is read once.
    let writes = 0;
    let owed = null;

    /**
     * Refresh data from server: the rows shown, every page an appended list holds read again at once; in a grouped
     * list, its axis and the rows each group holds. Nothing while the list takes a whole state, which a read follows;
     * once they are done while the list writes
     */
    const refresh = () => {
        if (settling) {
            return Promise.resolve();
        }

        if (writes > 0) {
            if (!owed) {
                let resolve = null;
                const promise = new Promise((done) => {
                    resolve = done;
                });

                owed = { promise, resolve };
            }

            return owed.promise;
        }

        return fetchItems('held');
    };

    /**
     * Run a write of the list, whose rows already say what it changes: a
     * refresh asked while it runs reads once it is done.
     *
     * @template T
     * @param {() => Promise<T>} write
     * @returns {Promise<T>}
     */
    const writing = async (write) => {
        writes += 1;

        try {
            return await write();
        } finally {
            writes -= 1;

            if (writes === 0 && owed) {
                const { resolve } = owed;

                owed = null;
                void refresh().then(resolve, resolve);
            }
        }
    };

    /**
     * Reset pagination to first page
     */
    const resetPagination = () => {
        currentPage.value = 1;
    };

    const hasMore = computed(
        () => !groupBy.value && (firstHeld - 1) * pageSize.value + rows.value.length < count.value
    );

    // The page loadMore moves to is its own to read, added to the rows: the
    // watcher of the page does not read it again in their place.
    let pageOfMore = null;

    /**
     * Load the next page and keep the items already loaded, whether the list appends or pages; in a grouped list,
     * each group says it
     * @returns {Promise<void>}
     */
    const loadMore = async () => {
        if (loading.value || !hasMore.value) {
            return;
        }

        currentPage.value += 1;
        pageOfMore = currentPage.value;

        await fetchItems('more');
    };

    /**
     * Read again from the first page, whatever page is loaded
     */
    const reload = () => {
        if (config.append || currentPage.value === 1) {
            currentPage.value = 1;

            void queueRead('page');

            return;
        }

        resetPagination();
    };

    /**
     * Export data with current filters and sorting
     * @param {string} format - Export format: 'csv', 'xlsx', 'json'
     * @returns {Promise<Blob>}
     */
    const exportData = async (format = 'csv') => {
        const response = await service.export({
            fields: config.exportFields || fields.value,
            filter: filter.value,
            orderBy: orderBy.value,
            format,
        });

        return await response.blob();
    };

    /**
     * Import data from a file
     * @param {File} file - File to import (CSV, XLSX, ODS)
     * @param {{ delimiter?: string }} [options] - The column delimiter of a CSV, detected by the server when absent
     * @returns {Promise<Object>} - Import result with statistics
     */
    const importData = async (file, options = {}) => {
        try {
            const response = await service.import(file, options.delimiter ? { delimiter: options.delimiter } : {});
            const result = response.data;

            if (result.success > 0) {
                await refresh();
            }

            return result;
        } catch (err) {
            // A file the server read and refused row by row is a result, not a failure.
            if (err?.data?.detail?.error_details) {
                return err.data.detail;
            }

            throw err;
        }
    };

    // The group holding a row, null for none.
    const holding = (id) => groups.value.find((group) => group.items.some((row) => sameId(row.id, id))) ?? null;

    /**
     * Resequence items, holding the loading state and reading the rows again
     * @param {Array<number>} ids - New order of item IDs
     * @param {{ groupField?: string, groupValue?: any }} [options] - The group the ids are moved to
     * @returns {Promise<void>}
     */
    const resequenceWithState = async (ids, options = {}) => {
        if (sortableModel.value && !isSortable.value) {
            console.warn('[useDataIterator] Resequencing waits for the list to be narrowed by nothing');

            await refresh();

            return;
        }

        // The rows shown come after the pages before them: their ranks count from there.
        const group = groupBy.value ? holding(ids[0]) : null;
        const sequenceOffset = group ? (holds.get(group).first - 1) * rowLimit : (firstHeld - 1) * pageSize.value;

        try {
            resequencing.value = true;

            await resequence(ids, { ...options, sequenceOffset });
            await refresh();
        } finally {
            resequencing.value = false;
        }
    };

    // The group a row belongs to by its value, null when it does not carry the
    // field of the groups.
    const groupOfRow = (row) => {
        const field = groupBy.value;

        if (!field || !(field in row)) {
            return null;
        }

        const raw = row[field];
        const value = raw !== null && typeof raw === 'object' ? raw.id : raw;

        return (
            groups.value.find((group) =>
                group.isEmptyBucket ? value == null : value != null && String(group.value) === String(value)
            ) ?? null
        );
    };

    const dropRow = (group, id) => {
        const kept = group.items.filter((row) => !sameId(row.id, id));

        if (kept.length < group.items.length) {
            group.items = kept;
            group.total = Math.max(0, group.total - 1);
        }
    };

    const putRow = (group, item, prepend) => {
        const at = group.items.findIndex((row) => sameId(row.id, item.id));

        if (at >= 0) {
            group.items = group.items.map((row, index) => (index === at ? item : row));

            return;
        }

        group.items = prepend ? [item, ...group.items] : [...group.items, item];
        group.total += 1;
    };

    /**
     * Put a row in place of the one holding its id, or add it at the end (at the start with `prepend`); in a grouped
     * list, in the group of its value, which it leaves another one for
     * @param {Object} item
     * @param {{ prepend?: boolean }} [options]
     * @returns {boolean} - Whether the list holds it
     */
    const upsertLocal = (item, { prepend = false } = {}) => {
        if (!groupBy.value) {
            const at = rows.value.findIndex((row) => sameId(row.id, item.id));

            if (at >= 0) {
                rows.value = rows.value.map((row, index) => (index === at ? item : row));
            } else {
                rows.value = prepend ? [item, ...rows.value] : [...rows.value, item];
                count.value += 1;
            }

            return true;
        }

        const from = holding(item.id);
        const into = groupOfRow(item) ?? from;

        if (!into) {
            return false;
        }

        if (from && from !== into) {
            dropRow(from, item.id);
        }

        putRow(into, item, prepend);

        return true;
    };

    /**
     * The row the list holds for an id, null for none
     * @param {string|number} id
     * @returns {Record<string, any>|null}
     */
    const byId = (id) => items.value.find((row) => sameId(row.id, id)) ?? null;

    const canMoveToGroup = computed(() => {
        const field = modelMeta.value?.fields?.[groupBy.value];

        return Boolean(field) && !field.readonly && field.type !== 'computed';
    });

    const canMoveGroups = computed(() => Boolean(groupBy.value && axisState.sequenceField));

    /**
     * Move a row to a group, at [index] among its rows, at their end without one: at once on the screen, its value and
     * the totals of both groups included, then the order of the group with its value in one request, its rows counted
     * from the rank of its first page. A field of the workspace, which that request does not write, is written on the
     * row first; without a manual order to keep, the value alone is written. A refusal reads the groups again and is
     * thrown
     * @param {Object} item
     * @param {DataGroup} group
     * @param {number|null} [index]
     * @returns {Promise<void>}
     */
    const moveTo = async (item, group, index = null) => {
        const field = groupBy.value;
        const target = groups.value.find((one) => one.key === group?.key);

        if (!field || !target) {
            throw new Error(`The list shows no group ${group?.key}`);
        }

        const from = holding(item.id);
        const inPlace = from === target;
        const ordered = isSortable.value;
        const extra = modelMeta.value?.fields?.[field]?.extra === true;

        if (!inPlace && !canMoveToGroup.value) {
            throw new Error(`The field ${field} is not written`);
        }

        if (inPlace && !ordered) {
            return;
        }

        const value = target.isEmptyBucket ? null : target.value;
        const moved = inPlace ? item : { ...item, [field]: target.record ?? value };
        const placed = target.items.filter((row) => !sameId(row.id, item.id));

        placed.splice(index == null || index < 0 || index > placed.length ? placed.length : index, 0, moved);

        if (!inPlace) {
            if (from) {
                dropRow(from, item.id);
            }

            target.total += 1;
        }

        target.items = placed;

        try {
            await writing(async () => {
                if (!inPlace && (extra || !ordered)) {
                    await service.update(item.id, { [field]: value });
                }

                if (ordered) {
                    await resequence(
                        placed.map((row) => row.id),
                        {
                            sequenceOffset: (holds.get(target).first - 1) * rowLimit,
                            ...(!inPlace && !extra ? { groupField: field, groupValue: value } : {}),
                        }
                    );
                }
            });
        } catch (cause) {
            await refresh();

            throw cause;
        }
    };

    /**
     * Move a group to [index] on its axis, the group with no value keeping its place: at once on the screen, then the
     * order of the axis is sent to the model of its records. Only on an axis of records ordered by hand; a refusal
     * reads the axis again and is thrown
     * @param {DataGroup} group
     * @param {number} index
     * @returns {Promise<void>}
     */
    const moveGroup = async (group, index) => {
        const moving = groups.value.find((one) => one.key === group?.key);

        if (!axis?.sequenceField || !moving) {
            throw new Error('The groups of the list are not ordered by hand');
        }

        if (moving.isEmptyBucket) {
            return;
        }

        const empty = groups.value.find((one) => one.isEmptyBucket) ?? null;
        const emptyFirst = groups.value[0]?.isEmptyBucket ?? false;
        const others = groups.value.filter((one) => !one.isEmptyBucket && one !== moving);
        const at = Math.min(Math.max(emptyFirst ? index - 1 : index, 0), others.length);

        others.splice(at, 0, moving);
        groups.value = [...(empty && emptyFirst ? [empty] : []), ...others, ...(empty && !emptyFirst ? [empty] : [])];

        try {
            await useDataset({ prefix: datasetPrefix }).resequence(
                axis.target,
                others.map((one) => one.value),
                { sequenceField: axis.sequenceField, sequenceOffset: (axisState.page - 1) * AXIS_LIMIT }
            );
        } catch (cause) {
            await reloadAxis();

            throw cause;
        }
    };

    /**
     * Show a page of the axis, when it is made of records: the groups that stay keep their rows
     * @param {number} page
     * @returns {Promise<void>}
     */
    const setGroupPage = (page) =>
        axis && page >= 1 && page <= Math.max(1, axisState.totalPages)
            ? readAxis(latest, page, 'page')
            : Promise.resolve();

    // The filter of every row the list shows, each page included: the one it
    // sends, or the one of each group shown.
    const rowsFilter = computed(() => {
        if (!groupBy.value) {
            return filter.value;
        }

        const filters = groups.value.map(filterOf);

        return filters.length === 1 ? filters[0] : ['|', filters];
    });

    const groupableFields = computed(() => Object.values(modelMeta.value?.fields ?? {}).filter(isGroupable));

    // Selection
    const { isSelectionEnabled, selection } = useSelection({
        enabled: config.enableSelection,
        items,
        total,
    });

    // On what the rules say, not on the array that says it: the filter is built
    // again whenever anything it reads is recomputed, and a deep watcher takes
    // each of those for a change, so the screen read its whole list again for
    // rules it was already showing. The filter the screen sets is among them.
    // A selection made under other rules is not this list's: it is emptied.
    watch(
        () => JSON.stringify(filter.value ?? null),
        () => {
            selection.clear();

            if (!settling) {
                reload();
            }
        }
    );

    // A column added is another read; a column removed, or the fields the read
    // already carried, are not.
    watch(
        () => fields.value.join(','),
        () => {
            if (!settling && latest > 0 && fields.value.some((one) => !readFields?.has(one))) {
                void queueRead('held');
            }
        }
    );

    // Watch sorting changes - update URL and fetch
    watch(
        orderBy,
        (newOrderBy) => {
            if (settling) {
                return;
            }

            const byDefault = JSON.stringify(newOrderBy ?? null) === JSON.stringify(config.defaultOrderBy ?? null);

            writeQuery({ order_by: byDefault ? null : formatOrderBy(newOrderBy) });

            reload();
        },
        { deep: true }
    );

    // Watch the grouping - update URL and read the groups, or the rows of a flat list
    watch(groupBy, () => {
        if (settling) {
            return;
        }

        writeQuery({ g: shownAs.g() });

        reload();
    });

    // Watch page size changes - read again from the first page, already there or not, and update URL
    watch(pageSize, (newSize) => {
        if (settling) {
            return;
        }

        reload();

        writeQuery({ s: newSize });
    });

    // Watch page changes - update URL and fetch
    watch(currentPage, (newPage) => {
        if (settling) {
            return;
        }

        writeQuery({ p: newPage > 1 ? newPage : null });

        const byMore = newPage === pageOfMore;

        pageOfMore = null;

        if (!config.append && !byMore) {
            void queueRead('page');
        }
    });

    // Search - applied after a pause in the typing, kept in the URL as `q`
    let searchTimer = null;

    watch(search, (value) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            appliedSearch.value = (value ?? '').trim();
        }, 300);
    });

    watch(appliedSearch, (value) => writeQuery({ q: value }));

    // Nothing for a list on its view as the view says it, the expression once
    // it moves away from it, `null` written out for filters cleared off a view.
    const writtenExpression = () => {
        const current = expression.value ?? null;

        if (view.value === null) {
            return current ? JSON.stringify(current) : null;
        }

        if (viewExpression.value !== undefined && sameExpression(current, viewExpression.value)) {
            return null;
        }

        return JSON.stringify(current);
    };

    watch(
        () =>
            JSON.stringify([
                expression.value ?? null,
                view.value,
                viewExpression.value === undefined ? '?' : viewExpression.value,
            ]),
        () => writeQuery({ f: writtenExpression() })
    );

    watch(view, (id) => writeQuery({ cv: id }));

    watch(
        () => JSON.stringify(quickFilters.map((one) => quick[one.name] ?? null)),
        () => writeQuery({ qf: writeQuickFilters(quick, quickFilters) })
    );

    // What each followed key says of the list as it stands: the value it would be written with.
    const shownAs = {
        p: () => (currentPage.value > 1 ? String(currentPage.value) : null),
        s: () => String(pageSize.value),
        order_by: () =>
            JSON.stringify(orderBy.value ?? null) === JSON.stringify(config.defaultOrderBy ?? null)
                ? null
                : formatOrderBy(orderBy.value),
        q: () => appliedSearch.value || null,
        f: () => writtenExpression(),
        cv: () => (view.value === null ? null : String(view.value)),
        qf: () => writeQuickFilters(quick, quickFilters),
        g: () => (groupBy.value === defaultGroupBy ? null : (groupBy.value ?? 'none')),
    };

    /**
     * Whether the URL moved under the list: a key saying something the list
     * neither holds nor wrote. A size the URL leaves out keeps the one chosen.
     *
     * @param {Record<string, any>} query
     * @returns {boolean}
     */
    const movedFromOutside = (query) => {
        let moved = false;

        for (const [key, current] of Object.entries(shownAs)) {
            const value = typeof query[key] === 'string' ? query[key] : null;
            const pending = sent.get(key) ?? [];
            const own = pending.indexOf(value);

            if (own >= 0) {
                sent.set(key, pending.slice(own + 1));
            } else if (value !== current() && !(key === 's' && value === null)) {
                moved = true;
            }
        }

        return moved;
    };

    /**
     * Hold what a URL changed from outside says (back, forward, a link followed
     * to the same screen), as a list entered on it would, then read once.
     */
    const followUrl = async () => {
        const query = urlQuery();

        if (!opened.value || !movedFromOutside(query)) {
            return;
        }

        sent.clear();
        settling = true;

        try {
            const page = Number.parseInt(query.p ?? '', 10);
            const size = Number.parseInt(query.s ?? '', 10);

            currentPage.value = page > 0 ? page : 1;

            if (config.availablePageSizes.includes(size)) {
                pageSize.value = size;
            }

            search.value = typeof query.q === 'string' ? query.q : '';
            appliedSearch.value = search.value.trim();
            Object.assign(quick, readQuickFilters(query.qf, quickFilters));

            const linked = readId(query.cv);

            if (linked !== view.value) {
                let named = null;

                if (linked !== null && config.views) {
                    const reading = useOpeningView(modelName, {
                        scope: config.views.scope,
                        prefix: viewsPrefix,
                        id: linked,
                    });

                    await reading.promise;
                    named = reading.view.value;

                    applyView(named, query);
                }

                view.value = config.views ? (named?.id ?? null) : linked;
                viewExpression.value = named ? (named.filters ?? null) : undefined;
            }

            expression.value =
                'f' in query ? readExpression(query.f) : view.value !== null ? (viewExpression.value ?? null) : null;
            orderBy.value = parseOrderBy(query.order_by) ?? config.defaultOrderBy ?? null;
            groupBy.value = groupByOf(typeof query.g === 'string' ? query.g : null);

            await nextTick();
        } finally {
            settling = false;
        }

        await fetchItems();
    };

    if (config.url !== false) {
        watch(
            () => JSON.stringify(Object.keys(shownAs).map((key) => urlQuery()[key] ?? null)),
            () => void followUrl()
        );
    }

    /**
     * Start over in the workspace switched to, as a list opened there at once:
     * its state back to the opening, the metadata of that workspace waited for
     * and what hangs on it resolved again (its columns included), its opening
     * view read there, then one read. The rows of the other workspace go
     * meanwhile.
     */
    const startOver = async () => {
        sent.clear();
        settling = true;
        ++latest;

        try {
            selection.clear();
            rows.value = [];
            count.value = 0;
            dropGroups();
            loaded.value = false;
            currentPage.value = 1;
            firstHeld = 1;
            clearTimeout(searchTimer);
            search.value = '';
            appliedSearch.value = '';
            customFilter.value = null;
            Object.assign(quick, readQuickFilters(null, quickFilters));
            view.value = null;
            viewExpression.value = undefined;
            expression.value = null;
            orderBy.value = config.defaultOrderBy ?? null;
            groupBy.value = defaultGroupBy;

            const next = metadataStore.getMetadata(modelName);

            await Promise.all([readMetadata(next), readModel(next), layout.value?.load()]);

            if (config.views) {
                const reading = useOpeningView(modelName, { scope: config.views.scope, prefix: viewsPrefix });

                await reading.promise;

                const start = reading.view.value;

                applyView(start);

                if (start) {
                    expression.value = start.filters ?? null;
                    viewExpression.value = start.filters ?? null;
                    view.value = start.id;
                    orderBy.value = start.order_by ?? config.defaultOrderBy ?? null;

                    if (keepsGrouping) {
                        groupBy.value = groupByOf(start.group_by);
                    }
                }
            }

            await nextTick();
        } finally {
            settling = false;
        }

        writeQuery({
            p: null,
            q: null,
            qf: null,
            sl: null,
            f: writtenExpression(),
            cv: view.value,
            order_by: shownAs.order_by(),
            g: shownAs.g(),
        });
        void nextTick(() => scrollElement()?.scrollTo?.({ top: 0 }));

        await fetchItems();
    };

    // The switch is the workspace store's: a list born after it began reads in
    // the new workspace already.
    const born = performance.now();

    const onSwitch = (event) => {
        if ((event?.detail?.since ?? Infinity) >= born) {
            void startOver();
        }
    };

    bus.addEventListener(RESOURCES_STALE, onSwitch);

    // Scroll position - kept in the URL as `sl`
    function scrollElement() {
        const target = toValue(config.scrollTarget);

        return target?.$el ?? target ?? null;
    }

    let scrollTimer = null;

    watch(
        scrollElement,
        (element, _previous, onCleanup) => {
            if (!element) {
                return;
            }

            const onScroll = () => {
                clearTimeout(scrollTimer);
                scrollTimer = setTimeout(() => {
                    const top = Math.round('scrollY' in element ? element.scrollY : element.scrollTop);

                    writeQuery({ sl: top > 0 ? top : null });
                }, 350);
            };

            element.addEventListener('scroll', onScroll, { passive: true });
            onCleanup(() => element.removeEventListener('scroll', onScroll));
        },
        { immediate: true }
    );

    if (getCurrentScope()) {
        onScopeDispose(() => {
            clearTimeout(searchTimer);
            clearTimeout(scrollTimer);
            bus.removeEventListener(RESOURCES_STALE, onSwitch);
            follow(null);
        });
    }

    // Initial fetch, held back until the caller says the list is ready, the
    // metadata and the columns of the list read: the list enabled while it
    // waits for them reads once.
    let starting = null;

    const start = () =>
        (starting ??= Promise.all([sortableReady, modelReady])
            .then(() => layout.value?.ready)
            .then(() => {
                starting = null;

                return fetchItems();
            }));

    watch(
        enabled,
        (on) => {
            if (on) {
                void start();
            }
        },
        { immediate: true }
    );

    return {
        // Data
        items,
        total,
        loading,
        loaded,
        error,
        fields,
        byId,
        upsertLocal,
        writing,

        // Pagination
        currentPage,
        pageSize,
        availablePageSizes: config.availablePageSizes,
        totalPages: computed(() => Math.ceil(total.value / pageSize.value)),
        hasMore,
        loadMore,

        // Filter
        filter: customFilter,
        combinedFilter: filter,
        rowsFilter,
        expression,
        search,
        view,
        viewExpression,
        viewState,
        applyView,
        opened: readonly(opened),
        quick,
        quickFilters: config.quickFilters ?? [],
        defaultOrderBy: config.defaultOrderBy ?? null,

        // Order by
        orderBy,
        toggleSort,
        getSortDirection,

        // Groups
        groupBy,
        defaultGroupBy,
        groupByOf,
        groups: computed(() => groups.value),
        groupPage: computed(() => axisState.page),
        groupTotalPages: computed(() => axisState.totalPages),
        setGroupPage,
        groupableFields,
        canMoveToGroup,
        canMoveGroups,
        moveTo,
        moveGroup,

        // Columns
        layout,
        displayFields,

        // Sortable
        isSortable,
        resequence: resequenceWithState,

        // Selection
        isSelectionEnabled,
        selection,

        // Methods
        refresh,
        resetPagination,
        exportData,
        importData,
    };
}
