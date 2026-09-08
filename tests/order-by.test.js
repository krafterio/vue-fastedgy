/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { describe, expect, it } from 'vitest';
import { formatOrderBy, orderByTerm, parseOrderBy } from '../utils/order-by.js';
import { numberOrNull, trimmedOrNull } from '../utils/models.js';

describe('order by', () => {
    it('reads an ordering written as one string', () => {
        expect(parseOrderBy('name:asc,created_at:desc')).toEqual(['name:asc', 'created_at:desc']);
        expect(parseOrderBy('name')).toEqual(['name']);
    });

    it('says nothing for an ordering nobody asked for', () => {
        expect(parseOrderBy(null)).toBeNull();
        expect(parseOrderBy('')).toBeNull();
        expect(formatOrderBy([])).toBeNull();
        expect(formatOrderBy(null)).toBeNull();
    });

    it('writes an ordering back as one string', () => {
        expect(formatOrderBy(['name:asc', 'created_at:desc'])).toBe('name:asc,created_at:desc');
    });

    it('reads the field a term names and the direction it asks for', () => {
        expect(orderByTerm('name:desc')).toEqual({ field: 'name', direction: 'desc' });
        expect(orderByTerm('name')).toEqual({ field: 'name', direction: 'asc' });
    });
});

describe('payload values', () => {
    it('keeps the text a field holds, and nothing of the spaces', () => {
        expect(trimmedOrNull('  Krafter ')).toBe('Krafter');
        expect(trimmedOrNull('   ')).toBeNull();
        expect(trimmedOrNull(null)).toBeNull();
    });

    it('reads a number, and nothing of what is not one', () => {
        expect(numberOrNull(' 12 ')).toBe(12);
        expect(numberOrNull('1.5')).toBe(1.5);
        expect(numberOrNull('')).toBeNull();
        expect(numberOrNull('nope')).toBeNull();
    });
});
