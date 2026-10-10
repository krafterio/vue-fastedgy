/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMetadataStore } from '../stores/metadata.js';

const tokenExpiringIn = (seconds) =>
    `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }))}.signature`;

describe('the metadata store', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    it('answers null for a model while signed out, rather than failing', async () => {
        await expect(useMetadataStore().getMetadata('aisle')).resolves.toBeNull();
    });

    it('answers null for a model when the server cannot be reached, rather than failing', async () => {
        localStorage.setItem('access_token', tokenExpiringIn(600));
        localStorage.setItem('refresh_token', 'the-refresh-token');
        vi.spyOn(window, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(useMetadataStore().getMetadata('aisle')).resolves.toBeNull();
    });
});
