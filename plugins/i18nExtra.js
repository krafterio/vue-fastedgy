/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import {createI18nExtraTranslateContentDirective} from '../directives/i18nExtra.js';

/**
 * Create a plugin with the v-tc directive.
 *
 * @param {import("vue-i18n").I18n} i18n
 *
 * @returns {import("vue").Plugin}
 */
export const createI18nExtra = (i18n) => {
    return {
        install(app) {
            app.directive('tc', createI18nExtraTranslateContentDirective(i18n));
        }
    };
};
