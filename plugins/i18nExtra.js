/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { createI18nExtraTranslateContentDirective } from '../directives/i18nExtra.js';
import { fr } from '../locales/fr.js';
import { addLocaleMessages, setI18n } from '../utils/i18n.js';

// The package's own words go through the same door as anybody else's, and wait
// there until an application names its i18n.
addLocaleMessages({ fr });

/**
 * Create a plugin with the v-tc directive.
 *
 * @param {import("vue-i18n").I18n} i18n
 *
 * @returns {import("vue").Plugin}
 */
export const createI18nExtra = (i18n) => {
    setI18n(i18n);

    return {
        install(app) {
            app.directive('tc', createI18nExtraTranslateContentDirective(i18n));
        },
    };
};
