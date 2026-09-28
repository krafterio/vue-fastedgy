/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

let instance = null;

let sourceLanguage = null;

/** The keys the application writes, in any language: it has the last word on them. */
let applicationKeys = new Set();

/**
 * What packages have handed over, kept until an application names its i18n.
 *
 * A package is imported before the application installs anything, so its words
 * arrive first and wait here; one imported later finds the i18n already named
 * and is merged on the spot. Either way the order of the imports decides
 * nothing.
 */
const offered = [];

/**
 * Hand the i18n of the application to the packages that speak to a user.
 *
 * `useI18n()` only answers inside a `setup()`, and a package says things from
 * places that have none: a store created by a route guard, a plain function.
 * `createI18nExtra` names here the i18n it creates, with its languages.
 *
 * @param {import("vue-i18n").I18n|null} i18n
 * @param {{ sourceLocale?: string }} [locales]
 */
export function setI18n(i18n, { sourceLocale = null } = {}) {
    instance = i18n || null;
    sourceLanguage = sourceLocale;
    applicationKeys = new Set(Object.values(instance?.global?.messages?.value ?? {}).flatMap(Object.keys));
    instance?.global?.setMissingHandler?.(reportMissing);

    for (const entry of offered) {
        mergeInto(instance, entry);
    }
}

/**
 * Hand over the words a package says, by locale.
 *
 * Its keys are written in its source language, English unless the package
 * names another: there, they are the text already, and need no catalog. A key the application writes stays its own in
 * every language, so its wording wins over the one a package ships, and a key of
 * its own never takes the word of a package. Called at import time by the
 * package itself, so an application that installs it gets its words and writes
 * none of them.
 *
 * @param {Record<string, Record<string, string>>} messages - By locale
 * @param {string} [sourceLocale] - The language the keys are written in, when not English
 *
 * @example
 * addLocaleMessages({ fr: { Bold: 'Gras' } });
 */
export function addLocaleMessages(messages, sourceLocale) {
    if (!messages) {
        return;
    }

    const entry = { messages, sourceLocale };

    offered.push(entry);
    mergeInto(instance, entry);
}

/** Merges the words of a package on the keys the application does not write, and only where they are missing. */
function mergeInto(i18n, { messages, sourceLocale }) {
    if (typeof i18n?.global?.mergeLocaleMessage !== 'function') {
        return;
    }

    const source = sourceLocale ?? 'en';
    const keys = [...new Set(Object.values(messages).flatMap(Object.keys))];
    const catalogs = {
        ...messages,
        [source]: { ...Object.fromEntries(keys.map((key) => [key, key])), ...messages[source] },
    };

    for (const [locale, words] of Object.entries(catalogs)) {
        const known = i18n.global.getLocaleMessage(locale) || {};
        const missing = Object.fromEntries(
            Object.entries(words).filter(([key]) => !applicationKeys.has(key) && !(key in known))
        );

        if (Object.keys(missing).length > 0) {
            i18n.global.mergeLocaleMessage(locale, missing);
        }
    }
}

/** The source language of whoever owns a key: a package knowing it, unless the application writes it. */
function sourceOf(key) {
    if (!applicationKeys.has(key)) {
        for (const { messages, sourceLocale } of offered) {
            if (Object.values(messages).some((words) => key in words)) {
                return sourceLocale ?? 'en';
            }
        }
    }

    return sourceLanguage;
}

/** In development, a key missing outside the source language of whoever owns it. */
function reportMissing(target, key) {
    const source = sourceOf(key);

    if (import.meta.env?.DEV && source && target.split('-')[0] !== source.split('-')[0]) {
        console.warn(`[intlify] Not found '${key}' key in '${target}' locale messages.`);
    }
}

/**
 * Translate a message where `useI18n()` does not answer, with the same words as `$t`.
 *
 * The values a message carries are given here, where they are known: a sentence
 * already filled in cannot be translated afterwards.
 *
 * @param {string} key
 * @param {Object} [named] - Values of the placeholders the message carries
 * @returns {string} - The key itself when the application installed no i18n
 *
 * @example
 * t('Not found');
 * t('{count} rows imported', { count: 12 });
 */
export function t(key, named) {
    const global = instance?.global;

    if (!key || typeof global?.t !== 'function') {
        return key;
    }

    return named === undefined ? global.t(key) : global.t(key, named);
}
