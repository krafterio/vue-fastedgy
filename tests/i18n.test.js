/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';
import { createI18nExtra } from '../plugins/i18nExtra.js';
import { addLocaleMessages, setI18n, t } from '../utils/i18n.js';
import { formatValidationErrors } from '../utils/validations.js';

const application = (messages = {}) =>
    createI18n({
        legacy: false,
        locale: 'fr',
        fallbackLocale: 'fr',
        fallbackFormat: true,
        missingWarn: false,
        fallbackWarn: false,
        messages: { fr: messages },
    });

afterEach(() => setI18n(null));

describe('t', () => {
    it('says the key itself when the application installed no i18n', () => {
        setI18n(null);

        expect(t('Unknown error')).toBe('Unknown error');
    });

    it('speaks the language of the application', () => {
        createI18nExtra(application());

        expect(t('Unknown error')).toBe('Erreur inconnue');
    });

    it('fills in what the message carries, where the values are known', () => {
        createI18nExtra(application({ '{count} rows imported': '{count} lignes importées' }));

        expect(t('{count} rows imported', { count: 12 })).toBe('12 lignes importées');
    });
});

describe('createI18nExtra', () => {
    it('gives the application the French of the package', () => {
        const i18n = application();

        createI18nExtra(i18n);

        expect(i18n.global.t('Unknown error')).toBe('Erreur inconnue');
    });

    it('leaves the wording the application already has', () => {
        const i18n = application({ 'Unknown error': 'Oups' });

        createI18nExtra(i18n);

        expect(i18n.global.t('Unknown error')).toBe('Oups');
    });

    it('hands back untouched what it does not translate', () => {
        const i18n = application();

        createI18nExtra(i18n);

        expect(i18n.global.t('Household not found')).toBe('Household not found');
    });
});

describe('addLocaleMessages', () => {
    it('takes the words of another package, whenever they are handed over', () => {
        addLocaleMessages({ fr: { Bold: 'Gras' } });

        const i18n = application();

        createI18nExtra(i18n);

        expect(i18n.global.t('Bold')).toBe('Gras');

        // And after, for a package imported later than the application.
        addLocaleMessages({ fr: { Italic: 'Italique' } });

        expect(i18n.global.t('Italic')).toBe('Italique');
    });

    it('leaves the wording the application already has', () => {
        const i18n = application({ Quote: 'Bloc de citation' });

        createI18nExtra(i18n);
        addLocaleMessages({ fr: { Quote: 'Citation' } });

        expect(i18n.global.t('Quote')).toBe('Bloc de citation');
    });
});

describe('formatValidationErrors', () => {
    it('reads the reason the server names', () => {
        expect(formatValidationErrors({ data: { detail: 'Too late' } })).toBe('Too late');
        expect(formatValidationErrors({ data: { detail: [{ msg: 'Field is required' }] } })).toBe('Field is required');
    });

    it('lists the fields when the server refused several', () => {
        const message = formatValidationErrors({
            data: { detail: [{ loc: ['body', 'name'], msg: 'required' }, { msg: 'too long' }] },
        });

        expect(message).toBe('• body → name: required\n• too long');
    });

    it('falls back on the wording it is given, then on its own', () => {
        createI18nExtra(application());

        expect(formatValidationErrors({ data: { detail: { code: 'nope' } } }, 'Export failed')).toBe('Export failed');
        expect(formatValidationErrors({ data: { detail: { code: 'nope' } } })).toBe('Erreur inconnue');
    });

    it('says nothing when the error carries no detail', () => {
        expect(formatValidationErrors({})).toBeUndefined();
    });
});
