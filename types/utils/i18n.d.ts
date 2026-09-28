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
export declare function setI18n(i18n: import("vue-i18n").I18n | null, { sourceLocale }?: {
    sourceLocale?: string;
}): void;
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
export declare function addLocaleMessages(messages: Record<string, Record<string, string>>, sourceLocale?: string): void;
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
export declare function t(key: string, named?: any): string;
//# sourceMappingURL=i18n.d.ts.map