/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import {createI18nExtraTranslateContentDirective} from '../directives/i18nExtra.js';
import {fr} from '../locales/fr.js';
import {setI18n} from '../utils/i18n.js';

/**
 * Hand the application the translations of the package.
 *
 * A key the application already translates is left alone: its wording wins over
 * the one shipped here.
 *
 * @param {import("vue-i18n").I18n} i18n
 */
function mergeMessages(i18n) {
    if (typeof i18n?.global?.mergeLocaleMessage !== 'function') {
        return;
    }

    for (const [locale, messages] of Object.entries({fr})) {
        const known = i18n.global.getLocaleMessage(locale) || {};
        const missing = Object.fromEntries(Object.entries(messages).filter(([key]) => !(key in known)));

        if (Object.keys(missing).length > 0) {
            i18n.global.mergeLocaleMessage(locale, missing);
        }
    }
}

/**
 * Create a plugin with the v-tc directive.
 *
 * @param {import("vue-i18n").I18n} i18n
 *
 * @returns {import("vue").Plugin}
 */
export const createI18nExtra = (i18n) => {
    setI18n(i18n);
    mergeMessages(i18n);

    return {
        install(app) {
            app.directive('tc', createI18nExtraTranslateContentDirective(i18n));
        }
    };
};
