/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { onUnmounted, ref, toValue, watch } from 'vue';
import { bus, useBus } from './bus.js';
import { useApiModel } from './api.js';
import { RESOURCE_CHANGED, realtime } from '../network/realtime.js';
import { useAuthStore } from '../stores/auth.js';
import { useWorkspaceStore } from '../stores/workspace.js';

/**
 * Keep the live socket in step with who is signed in and what they are reading.
 *
 * Called once, from the application shell. The workspace comes from the
 * workspace store, which the router keeps on the one in the URL; an application
 * that names it another way passes its own source.
 *
 * A page with no workspace (an onboarding, an auth screen) has nothing to
 * listen to: the socket waits rather than opening on nothing.
 *
 * @param {(function(): (String|null))|import("vue").Ref<String|null>} [workspace]
 *
 * @example
 * // In the application shell
 * import { useRealtime } from 'vue-fastedgy';
 *
 * useRealtime();
 *
 * @example
 * // An application that reads the workspace off the route itself
 * useRealtime(() => useRoute().params.workspace ?? null);
 */
export function useRealtime(workspace) {
    const authStore = useAuthStore();
    const source = workspace ?? (() => useWorkspaceStore().slug);

    watch(
        () => [authStore.isAuthenticated, authStore.token, toValue(source)],
        ([isAuthenticated, token, slug]) => {
            if (!isAuthenticated || !token) {
                realtime.disconnect();

                return;
            }

            // The server reads the token once, at the handshake: opening with a
            // dead one is refused for as long as it stays dead. The refresh
            // changes the token this watches, which comes back here.
            if (authStore.isTokenExpired && authStore.canRefreshToken) {
                void authStore.refreshAccessToken();

                return;
            }

            // An application that serves no workspace still wants the socket:
            // the one it names, when it names one, is announced as it arrives.
            realtime.connect(token, slug ?? null);
        },
        { immediate: true }
    );

    onUnmounted(() => realtime.disconnect());
}

/**
 * Hear one of the events the server announces for itself, while a view is on screen.
 *
 * Those are the announcements that belong to no model: a job that finished, a
 * message that arrived, whatever an application broadcasts under its own name.
 * The handler is called with the payload the server sent, and nothing else.
 *
 * @param {String}                 type    - Name the server announces it under
 * @param {function(any): void}    handler
 *
 * @example
 * useRealtimeEvent('aliment_image_generated', ({ label }) => toast.success(label));
 */
export function useRealtimeEvent(type, handler) {
    useBus(bus, type, (event) => handler(event.detail?.data ?? null));
}

/**
 * Hear about a model, or about one record of it, while a view is on screen.
 *
 * The one stream: a write made here and a write made by anyone else say the
 * same thing, once. The handler is called with `{model, id, action, changed,
 * origin, truncated}`, and events carry identifiers only, so read the record
 * back through the API.
 *
 * It is also called with `action: 'reconnected'` and no id when the socket
 * comes back, because nothing is replayed: what happened while it was down was
 * said to nobody, and the view has to read again to stop showing a stale
 * screen. That one is never held back.
 *
 * @param {String}                                                          model
 * @param {function({model: String, id: (String|Number|null), action: String,
 *                   changed: (String[]|null), origin: (String|null),
 *                   truncated: Boolean}): void}                            handler
 * @param {{id?: String|Number|null|(function(): (String|Number|null))|
 *              import("vue").Ref<String|Number|null>,
 *          watchFields?: String[]|null, refreshDelay?: Number}}            [options]
 *
 * @returns {function(): void} Stop listening
 *
 * @example
 * // A list that refreshes on any write of the model
 * useResourceChanged('company', () => reload());
 *
 * // A page that follows the record it reads, id and all
 * useResourceChanged('company', () => reload(), { id: () => route.params.id });
 *
 * // A list that only cares about the columns it shows
 * useResourceChanged('company', () => reload(), { watchFields: ['name', 'domain'] });
 */
export function useResourceChanged(model, handler, options = {}) {
    const { id = null, watchFields = null, refreshDelay = 250 } = options;
    const subscribed = { model, id: toValue(id) ?? null };
    let timer = null;

    const fire = (change) => {
        clearTimeout(timer);
        handler(change);
    };

    useBus(bus, RESOURCE_CHANGED, (event) => {
        const change = event.detail;

        if (change?.model !== model) {
            return;
        }

        if (subscribed.id !== null && change.id !== null && String(change.id) !== String(subscribed.id)) {
            return;
        }

        // A write that touched nothing this view depends on is news to somebody
        // else.
        if (watchFields && !touches(change, watchFields)) {
            return;
        }

        // A burst of writes is collapsed: a field saved on a timer fires one
        // event per tick, and re-reading on each of them is a request per
        // keystroke settled.
        clearTimeout(timer);

        if (refreshDelay > 0) {
            timer = setTimeout(() => handler(change), refreshDelay);
        } else {
            handler(change);
        }
    });

    useBus(bus, 'realtime:reconnected', () =>
        fire({ model, id: null, action: 'reconnected', changed: null, origin: null, truncated: true })
    );

    realtime.subscribe(subscribed.model, subscribed.id);

    if (typeof id === 'function' || id?.value !== undefined) {
        watch(
            () => toValue(id) ?? null,
            (next) => {
                realtime.unsubscribe(subscribed.model, subscribed.id);
                subscribed.id = next;
                realtime.subscribe(subscribed.model, subscribed.id);
            }
        );
    }

    const stop = () => {
        clearTimeout(timer);
        realtime.unsubscribe(subscribed.model, subscribed.id);
    };

    onUnmounted(stop);

    return stop;
}

/**
 * Whether something reading [read] has anything to learn from a change.
 *
 * Anything but an update always has: a row appearing or going changes a list
 * whatever its columns are. An update that did not say what it moved has too,
 * an event that says nothing meaning everything. And reading nothing in
 * particular is reading everything: a holder that has not said what it is after
 * cannot be told it is not concerned.
 *
 * A dotted path counts either way round, `company` moving being news to a
 * holder reading `company.name`.
 *
 * @param {{action: String, changed?: String[]|null}} event
 * @param {String[]}                                  read
 *
 * @returns {Boolean}
 */
export function touches(event, read) {
    const moved = event.changed;

    if (event.action !== 'updated' || !moved?.length || !read?.length) {
        return true;
    }

    return moved.some((one) =>
        read.some((other) => one === other || one.startsWith(`${other}.`) || other.startsWith(`${one}.`))
    );
}

/**
 * Hold one record, and keep it in step with what happens to it.
 *
 * It re-reads itself silently when the record is updated anywhere, and flips
 * `isDeleted` when it goes, so a detail screen can close itself. `id` may be a
 * getter or a ref, and the holder follows it.
 *
 * @param {String}                                                             model
 * @param {String|Number|(function(): (String|Number|null))|
 *         import("vue").Ref<String|Number|null>}                              id
 * @param {{fields?: String|String[], params?: object, immediate?: Boolean,
 *          api?: Object}}                                                     [options]
 *
 * @returns {{data: import("vue").Ref, status: import("vue").Ref<String>,
 *           error: import("vue").Ref, isDeleted: import("vue").Ref<Boolean>,
 *           refresh: function(): Promise<void>}}
 *
 * @example
 * const { data: company, status, isDeleted } = useApiRecord('company', () => route.params.id);
 */
export function useApiRecord(model, id, options = {}) {
    const { fields, params = {}, immediate = true, api = null } = options;
    // Its own reader when the application has one: a model served by a bespoke
    // endpoint is held exactly like any other.
    const reader = api ?? useApiModel(model, params);
    const data = ref(null);
    const status = ref('idle');
    const error = ref(null);
    const isDeleted = ref(false);

    const currentId = () => toValue(id) ?? null;

    async function read(quiet) {
        const wanted = currentId();

        if (wanted === null || wanted === undefined) {
            data.value = null;
            status.value = 'idle';

            return;
        }

        if (!quiet) {
            status.value = 'loading';
        }

        try {
            // The previous value is kept until the new one arrives: a silent
            // re-read must not blank the screen it is refreshing.
            const response = await reader.get(wanted, fields ? { fields } : {});

            data.value = response?.data ?? null;
            error.value = null;
            status.value = 'success';
        } catch (e) {
            if (quiet) {
                return;
            }

            error.value = e;
            status.value = 'error';
        }
    }

    // Through the same primitive an application uses, so a record held here and
    // a view listening by hand agree on what counts, reconnection included: the
    // socket coming back means re-reading, nothing having been replayed.
    useResourceChanged(
        model,
        (change) => {
            if (change.action === 'deleted') {
                isDeleted.value = true;
                data.value = null;

                return;
            }

            void read(true);
        },
        { id: currentId, refreshDelay: 0 }
    );

    if (typeof id === 'function' || id?.value !== undefined) {
        watch(currentId, () => {
            isDeleted.value = false;
            void read(false);
        });
    }

    if (immediate) {
        void read(false);
    }

    return { data, status, error, isDeleted, refresh: () => read(false) };
}

/**
 * Hold a list, and keep it in step with what happens to its model.
 *
 * A burst of writes is collapsed before the rows re-read, a field saved on a
 * timer firing one event per tick. A delete drops its row without going back to
 * the server, and an update that moved nothing the list reads is left alone.
 *
 * @param {String}                                                       model
 * @param {object|(function(): object)|import("vue").Ref<object>}        [query]
 * @param {{params?: object, immediate?: Boolean, refreshDelay?: Number,
 *          watchFields?: String[]|null, api?: object}}                  [options]
 *
 * @returns {{items: import("vue").Ref<Array>, total: import("vue").Ref<Number>,
 *           status: import("vue").Ref<String>, error: import("vue").Ref,
 *           refresh: function(): Promise<void>}}
 *
 * @example
 * const { items, total, status } = useApiCollection('company', () => ({ fields: 'id,name', limit: 25 }));
 */
export function useApiCollection(model, query = {}, options = {}) {
    const { params = {}, immediate = true, refreshDelay = 250, watchFields = null, api = null } = options;
    const reader = api ?? useApiModel(model, params);
    const items = ref([]);
    const total = ref(0);
    const status = ref('idle');
    const error = ref(null);
    let timer = null;

    const currentQuery = () => toValue(query) || {};

    const read = () => {
        const asked = currentQuery();

        return (
            watchFields ??
            String(asked.fields ?? '')
                .split(',')
                .filter(Boolean)
        );
    };

    async function load(quiet) {
        if (!quiet) {
            status.value = 'loading';
        }

        try {
            const response = await reader.list(currentQuery());
            const page = response?.data ?? {};

            items.value = page.items ?? [];
            total.value = page.total ?? items.value.length;
            error.value = null;
            status.value = 'success';
        } catch (e) {
            if (quiet) {
                return;
            }

            error.value = e;
            status.value = 'error';
        }
    }

    // Its own collapse rather than the primitive's: a delete is applied to the
    // rows on hand and must not wait behind it.
    useResourceChanged(
        model,
        (change) => {
            if (status.value === 'idle') {
                return;
            }

            if (change.action === 'deleted') {
                items.value = items.value.filter((one) => String(one?.id) !== String(change.id));
                total.value = Math.max(0, total.value - 1);

                return;
            }

            // A write that touched nothing these rows depend on is news to
            // somebody else.
            if (!touches(change, read())) {
                return;
            }

            clearTimeout(timer);
            timer = setTimeout(() => load(true), refreshDelay);
        },
        { refreshDelay: 0 }
    );

    if (typeof query === 'function' || query?.value !== undefined) {
        watch(currentQuery, () => void load(false), { deep: true });
    }

    if (immediate) {
        void load(false);
    }

    onUnmounted(() => clearTimeout(timer));

    return { items, total, status, error, refresh: () => load(false) };
}
