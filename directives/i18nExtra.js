/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { watch } from "vue";

/**
 * Directive v-tc (translate content) to handle long translations.
 *
 * @param {import("vue-i18n").I18n} i18n
 *
 * @returns {import("vue").Directive}
 */
export function createI18nExtraTranslateContentDirective(i18n) {
    const activeElements = new Map();
    let localeWatcher = null;

    if (
        i18n.global &&
        typeof i18n.global.locale === "object" &&
        i18n.global.locale.value
    ) {
        localeWatcher = watch(i18n.global.locale, () => {
            activeElements.forEach((binding, element) => {
                if (element.isConnected) {
                    processElement(element, binding, false);
                } else {
                    activeElements.delete(element);
                }
            });
        });
    }

    const processElement = (el, binding, isMount = false) => {
        const { t } = i18n.global;
        const params = binding.value || {};
        let translationKey;

        if (isMount) {
            translationKey = el.textContent.trim();
            el._vTcOriginalContent = translationKey;
        } else {
            translationKey = el._vTcOriginalContent || el.textContent.trim();
        }

        let translationParams =
            typeof params === "object" && params !== null ? params : {};

        if (translationKey) {
            el.textContent = t(translationKey, translationParams);
        }
    };

    return {
        mounted(el, binding) {
            processElement(el, binding, true);
            activeElements.set(el, binding);
        },

        updated(el, binding) {
            if (
                JSON.stringify(binding.oldValue) !==
                JSON.stringify(binding.value)
            ) {
                processElement(el, binding, false);
            }

            if (activeElements.has(el)) {
                activeElements.set(el, binding);
            }
        },

        unmounted(el) {
            activeElements.delete(el);

            if (activeElements.size === 0 && localeWatcher) {
                localeWatcher();
                localeWatcher = null;
            }
        },
    };
}
