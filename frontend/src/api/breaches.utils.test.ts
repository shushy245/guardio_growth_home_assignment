import { describe, expect, it } from 'vitest';

import { buildBreachesQuery } from '~/api/breaches.utils';
import { BreachSortColumn, SortOrder } from '~/models/breach';

describe('buildBreachesQuery', () => {
    it('sends nothing when nothing was asked for', () => {
        expect(buildBreachesQuery({})).toBe('');
    });

    it('sends the page and limit it was given', () => {
        expect(buildBreachesQuery({ page: 2, limit: 20 })).toBe('?page=2&limit=20');
    });

    it('sends the sort column and order', () => {
        expect(buildBreachesQuery({ sort: BreachSortColumn.PwnCount, order: SortOrder.Desc })).toBe(
            '?sort=pwnCount&order=desc',
        );
    });

    it('leaves out a filter that is not set rather than sending it empty', () => {
        // `?q=undefined` is a search for the literal string "undefined", which matches nothing.
        expect(buildBreachesQuery({ page: 1, q: undefined, dataClass: undefined })).toBe('?page=1');
    });

    it('leaves out an empty search string', () => {
        expect(buildBreachesQuery({ q: '' })).toBe('');
    });

    it('escapes a search term that would otherwise break the query string', () => {
        expect(buildBreachesQuery({ q: 'me&you=us' })).toBe('?q=me%26you%3Dus');
    });

    it('sends verifiedOnly only when it is on', () => {
        expect(buildBreachesQuery({ verifiedOnly: true })).toBe('?verifiedOnly=true');
        expect(buildBreachesQuery({ verifiedOnly: false })).toBe('');
    });
});
