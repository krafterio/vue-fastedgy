/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

let instance = null;

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
 * The application names its i18n once here, and `createI18nExtra` already does
 * it for an application that installs it.
 *
 * @param {import("vue-i18n").I18n|null} i18n
 */
export function setI18n(i18n) {
    instance = i18n || null;

    for (const messages of offered) {
        mergeInto(instance, messages);
    }
}

/**
 * Hand over the words a package says, by locale, English being the key.
 *
 * A key the application already translates is left alone: its wording wins over
 * the one a package ships, which is what makes a default overridable rather than
 * imposed. Called at import time by the package itself, so an application that
 * installs it gets its words and writes none of them.
 *
 * @param {Record<string, Record<string, string>>} messages - By locale
 *
 * @example
 * addLocaleMessages({ fr: { Bold: 'Gras' } });
 */
export function addLocaleMessages(messages) {
    if (!messages) {
        return;
    }

    offered.push(messages);
    mergeInto(instance, messages);
}

/** Merges what is missing, and only what is missing. */
function mergeInto(i18n, messages) {
    if (typeof i18n?.global?.mergeLocaleMessage !== 'function') {
        return;
    }

    for (const [locale, words] of Object.entries(messages)) {
        const known = i18n.global.getLocaleMessage(locale) || {};
        const missing = Object.fromEntries(Object.entries(words).filter(([key]) => !(key in known)));

        if (Object.keys(missing).length > 0) {
            i18n.global.mergeLocaleMessage(locale, missing);
        }
    }
}

/**
 * The i18n the application handed over, for a package that needs more than `t`.
 *
 * @returns {import("vue-i18n").I18n|null}
 */
export function getI18n() {
    return instance;
}

/**
 * Translate a message of a package, English being the key.
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
