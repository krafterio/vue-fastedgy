/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { de } from '../locales/de.js';
import { es } from '../locales/es.js';
import { fr } from '../locales/fr.js';
import { it as italian } from '../locales/it.js';
import { createI18nExtra } from '../plugins/i18nExtra.js';
import { addLocaleMessages, setI18n, t } from '../utils/i18n.js';
import { formatValidationErrors } from '../utils/validations.js';

const application = (messages = {}) => createI18nExtra({ availableLocales: ['fr'], messages: { fr: messages } });

const trilingual = (options) =>
    createI18nExtra({
        availableLocales: ['fr', 'en', 'es'],
        fallbackLocale: 'en',
        sourceLocale: 'fr',
        messages: {
            en: { Anniversaire: 'Birthday', 'Pas en espagnol': 'Not in Spanish' },
            es: { Anniversaire: 'Cumpleaños' },
        },
        ...options,
    });

afterEach(() => {
    setI18n(null);
    vi.restoreAllMocks();
});

describe('t', () => {
    it('says the key itself when the application installed no i18n', () => {
        setI18n(null);

        expect(t('Unknown error')).toBe('Unknown error');
    });

    it('speaks the language of the application', () => {
        application();

        expect(t('Unknown error')).toBe('Erreur inconnue');
    });

    it('fills in what the message carries, where the values are known', () => {
        application({ '{count} rows imported': '{count} lignes importées' });

        expect(t('{count} rows imported', { count: 12 })).toBe('12 lignes importées');
    });
});

describe('createI18nExtra', () => {
    it('leaves the wording the application already has', () => {
        application({ 'Unknown error': 'Oups' });

        expect(t('Unknown error')).toBe('Oups');
    });

    it('hands back untouched what it does not translate', () => {
        application();

        expect(t('Household not found')).toBe('Household not found');
    });

    it('shows the key in the source language, never the translation of the fallback', () => {
        trilingual({ locale: 'fr' });

        expect(t('Anniversaire')).toBe('Anniversaire');
        expect(t('Unknown error')).toBe('Erreur inconnue');
    });

    it('looks in the language, then in the fallback, then shows the key', () => {
        trilingual({ locale: 'es' });

        expect(t('Anniversaire')).toBe('Cumpleaños');
        expect(t('Pas en espagnol')).toBe('Not in Spanish');
        expect(t('Nulle part')).toBe('Nulle part');
    });

    it('takes the fallback as the language of the keys when no source language is given', () => {
        createI18nExtra({
            availableLocales: ['fr', 'en'],
            locale: 'fr',
            fallbackLocale: 'en',
            messages: { en: { Hello: 'Hi' } },
        });

        expect(t('Hello')).toBe('Hi');
    });

    it('starts in the language given, then in the first of the browser it offers, then in the fallback', () => {
        const hello = (options) => {
            createI18nExtra({
                availableLocales: ['fr', 'en'],
                messages: { fr: { Hello: 'Salut' }, en: { Hello: 'Hi' } },
                ...options,
            });

            return t('Hello');
        };

        expect(navigator.languages).toContain('en');
        expect(hello({ locale: 'fr' })).toBe('Salut');
        expect(hello({ locale: 'it' })).toBe('Hi');
        expect(hello({})).toBe('Hi');
        expect(hello({ availableLocales: ['fr', 'es'], fallbackLocale: 'fr' })).toBe('Salut');
    });

    it('reports a missing translation, never a key of the source language', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        trilingual({ locale: 'fr' });
        t('Nulle part');

        expect(warn).not.toHaveBeenCalled();

        trilingual({ locale: 'en' });
        t('Nulle part');

        expect(warn).toHaveBeenCalledWith("[intlify] Not found 'Nulle part' key in 'en' locale messages.");
    });

    it('installs vue-i18n and the v-tc directive', () => {
        const wrapper = mount(
            { template: '<p>{{ $t("Unknown error") }}</p><span v-tc>Export failed</span>' },
            { global: { plugins: [application()] } }
        );

        expect(wrapper.get('p').text()).toBe('Erreur inconnue');
        expect(wrapper.get('span').text()).toBe("Échec de l'export");
    });
});

describe('locales', () => {
    it('say every word of the package in every language it ships', () => {
        for (const words of [de, es, italian]) {
            expect(Object.keys(words).sort()).toEqual(Object.keys(fr).sort());
        }
    });

    it('say a word of the package in the language displayed', () => {
        trilingual({ locale: 'es' });

        expect(t('Unknown error')).toBe('Error desconocido');
    });
});

describe('addLocaleMessages', () => {
    it('takes the words of another package, whenever they are handed over', () => {
        addLocaleMessages({ fr: { Bold: 'Gras' } });

        application();

        expect(t('Bold')).toBe('Gras');

        // And after, for a package imported later than the application.
        addLocaleMessages({ fr: { Italic: 'Italique' } });

        expect(t('Italic')).toBe('Italique');
    });

    it('leaves the wording the application already has', () => {
        application({ Quote: 'Bloc de citation' });
        addLocaleMessages({ fr: { Quote: 'Citation' } });

        expect(t('Quote')).toBe('Bloc de citation');
    });

    it('never lends the word of a package to a key the application writes', () => {
        addLocaleMessages({ fr: { Location: 'Emplacement' } });
        trilingual({ locale: 'fr', messages: { en: { Location: 'Rental' } } });

        expect(t('Location')).toBe('Location');
    });

    it('shows a package key as written in its source language, with no catalog for it', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        trilingual({ locale: 'en' });

        expect(t('Unknown error')).toBe('Unknown error');
        expect(warn).not.toHaveBeenCalled();
    });

    it('reports a word a package has not translated, even in the source language of the application', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        addLocaleMessages({ es: { 'Only in Spanish': 'Solo en español' } });
        trilingual({ locale: 'fr' });

        expect(t('Only in Spanish')).toBe('Only in Spanish');
        expect(warn).toHaveBeenCalledWith("[intlify] Not found 'Only in Spanish' key in 'fr' locale messages.");
    });

    it('takes the source language a package names when it is not English', () => {
        addLocaleMessages({ en: { Hallo: 'Hello' } }, 'de');
        trilingual({ availableLocales: ['fr', 'en', 'de'], locale: 'de' });

        expect(t('Hallo')).toBe('Hallo');
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
        application();

        expect(formatValidationErrors({ data: { detail: { code: 'nope' } } }, 'Export failed')).toBe('Export failed');
        expect(formatValidationErrors({ data: { detail: { code: 'nope' } } })).toBe('Erreur inconnue');
    });

    it('falls back on its wording when the server named no reason, the network down for instance', () => {
        application();

        expect(formatValidationErrors(new TypeError('Failed to fetch'), 'Export failed')).toBe('Export failed');
        expect(formatValidationErrors({})).toBe('Erreur inconnue');
        expect(formatValidationErrors({ data: { detail: [] } })).toBe('Erreur inconnue');
    });

    it('says nothing without an error', () => {
        expect(formatValidationErrors(null)).toBeUndefined();
        expect(formatValidationErrors(undefined)).toBeUndefined();
    });
});
