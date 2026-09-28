/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { createI18n } from 'vue-i18n';
import { createI18nExtraTranslateContentDirective } from '../directives/i18nExtra.js';
import { fr } from '../locales/fr.js';
import { addLocaleMessages, setI18n } from '../utils/i18n.js';

// The package's own words go through the same door as anybody else's, and wait
// there until an application names its i18n.
addLocaleMessages({ fr });

/**
 * @typedef {Object} I18nExtraOptions
 * @property {string[]} availableLocales - The languages the application offers
 * @property {string} [locale] - The language the application gives, the account's for instance. Without it, the
 *     first language of the browser the application offers, then `fallbackLocale`
 * @property {string} [fallbackLocale] - The language of whoever speaks none of the others, and where a missing
 *     translation is looked up next. The first of `availableLocales` when not given
 * @property {string} [sourceLocale] - The language the application writes its keys in, `fallbackLocale` when not
 *     given. It goes from its own messages straight to the key
 */

/**
 * Create the i18n of the application, with the v-tc directive.
 *
 * The options are the ones every FastEdgy client shares, the Flutter one included, and are turned into those of
 * vue-i18n: a language looks in its own messages, then in those of `fallbackLocale`, then shows its key, and the
 * source language skips the fallback. Any other option, `messages` first, goes to vue-i18n as is. The words of the
 * packages join through `addLocaleMessages`, each with its own source language.
 *
 * @param {I18nExtraOptions & Record<string, any>} options
 *
 * @returns {import("vue").Plugin}
 */
export const createI18nExtra = ({
    availableLocales,
    locale,
    fallbackLocale = availableLocales[0],
    sourceLocale = fallbackLocale,
    ...options
}) => {
    const i18n = createI18n({
        ...options,
        legacy: false,
        locale: firstOffered([locale, ...(globalThis.navigator?.languages ?? [])], availableLocales) ?? fallbackLocale,
        fallbackLocale: Object.fromEntries(
            availableLocales
                .filter((available) => available !== sourceLocale && available !== fallbackLocale)
                .map((available) => [available, [fallbackLocale]])
        ),
        fallbackFormat: true,
        fallbackWarn: false,
    });

    setI18n(i18n, { sourceLocale });

    return {
        install(app) {
            app.use(i18n);
            app.directive('tc', createI18nExtraTranslateContentDirective(i18n));
        },
    };
};

const language = (locale) => locale.split('-')[0];

/** The first candidate the application offers, as it is or by its language. */
function firstOffered(candidates, availableLocales) {
    for (const candidate of candidates.filter(Boolean)) {
        if (availableLocales.includes(candidate)) {
            return candidate;
        }

        if (availableLocales.includes(language(candidate))) {
            return language(candidate);
        }
    }

    return null;
}
