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
export declare function setI18n(i18n: import("vue-i18n").I18n | null): void;
/**
 * The i18n the application handed over, for a package that needs more than `t`.
 *
 * @returns {import("vue-i18n").I18n|null}
 */
export declare function getI18n(): import("vue-i18n").I18n | null;
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
export declare function t(key: string, named?: any): string;
//# sourceMappingURL=i18n.d.ts.map