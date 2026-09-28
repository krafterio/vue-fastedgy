export type I18nExtraOptions = {
    /**
     * - The languages the application offers
     */
    availableLocales: string[];
    /**
     * - The language the application gives, the account's for instance. Without it, the
     * first language of the browser the application offers, then `fallbackLocale`
     */
    locale?: string;
    /**
     * - The language of whoever speaks none of the others, and where a missing
     * translation is looked up next. The first of `availableLocales` when not given
     */
    fallbackLocale?: string;
    /**
     * - The language the application writes its keys in, `fallbackLocale` when not
     * given. It goes from its own messages straight to the key
     */
    sourceLocale?: string;
};
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
export declare const createI18nExtra: ({ availableLocales, locale, fallbackLocale, sourceLocale, ...options }: I18nExtraOptions & Record<string, any>) => import("vue").Plugin;
//# sourceMappingURL=i18nExtra.d.ts.map