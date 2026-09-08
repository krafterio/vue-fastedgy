/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';
import { useNavigator } from '../composables/navigator.js';
import { useMetadataStore } from '../stores/metadata.js';

const routes = [
    { path: '/', name: 'Home', component: { template: '<div />' } },
    { path: '/users/:id', name: 'User', component: { template: '<div />' } },
];

describe('the peer ranges the package declares', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it('builds a setup store on the installed pinia', () => {
        const store = useMetadataStore();

        store.setPrefix('/api');

        expect(store.getPrefix()).toBe('/api');
    });

    it('reads history state and resolves routes on the installed vue-router', async () => {
        const router = createRouter({ history: createWebHistory(), routes });
        let navigator;

        mount(
            { template: '<div />', setup: () => void (navigator = useNavigator()) },
            { global: { plugins: [router] } }
        );

        await router.push({ name: 'User', params: { id: '1' } });

        expect(router.options.history.state).toHaveProperty('back');
        expect(router.resolve({ name: 'User', params: { id: '1' } }).name).toBe('User');

        await navigator.goBackTo('Home');

        expect(router.currentRoute.value.name).toBe('Home');
    });
});
