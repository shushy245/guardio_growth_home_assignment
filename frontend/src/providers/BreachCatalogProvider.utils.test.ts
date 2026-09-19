import { describe, expect, it } from 'vitest';

import { breachModel } from '~/models';
import type { BreachModel } from '~/models/breach';
import { BreachSortColumn, SortOrder } from '~/models/breach';
import { aBreachDTO, aCatalogRequest } from '~/testkit/builders';
import {
    areSameFilters,
    type CatalogFilters,
    FIRST_PAGE,
    type ListState,
    ListStatus,
    NO_FILTERS,
    receivePage,
} from '~/providers/BreachCatalogProvider.utils';

// One entry per filter the catalog has, each a value different from `NO_FILTERS`.
const changedFilters: Record<keyof CatalogFilters, CatalogFilters> = {
    sort: { sort: BreachSortColumn.PwnCount },
    order: { order: SortOrder.Asc },
    q: { q: 'adobe' },
    dataClass: { dataClass: 'Passwords' },
    verifiedOnly: { verifiedOnly: true },
};

describe('areSameFilters', () => {
    it('sees a change in every filter the catalog has', () => {
        // A filter the comparison forgets is one whose changes are swallowed: `withFilters`
        // keeps the request already in force and the visitor's chip does nothing (BF74). The
        // Record type makes a forgotten filter a compile error here and in the comparison.
        for (const [name, changed] of Object.entries(changedFilters)) {
            expect(areSameFilters(NO_FILTERS, changed), `a change to ${name} was not seen`).toBe(false);
            expect(areSameFilters(changed, NO_FILTERS), `${name} clearing was not seen`).toBe(false);
        }
    });

    it('is the same selection when nothing changed', () => {
        const filters: CatalogFilters = { sort: BreachSortColumn.Name, q: 'adobe', verifiedOnly: true };

        expect(areSameFilters(filters, { ...filters })).toBe(true);
    });
});

const aBreachNamed = (name: string): BreachModel => breachModel.fromDTO(aBreachDTO().withName(name).build());

describe('receivePage', () => {
    const itemNames = (state: ListState): string[] => ('items' in state ? state.items.map((item) => item.name) : []);

    it('drops a record the next page repeats', () => {
        // The catalog refreshes behind the visitor (S2b), so a record can move between page one
        // and page two and arrive on both. Keyed by name, React would then see a duplicate key
        // and drop a row (BF75).
        const onScreen: ListState = {
            status: ListStatus.Ready,
            items: [aBreachNamed('Adobe'), aBreachNamed('Canva')],
            total: 3,
            page: FIRST_PAGE,
        };

        const next = receivePage({
            current: onScreen,
            page: {
                items: [aBreachNamed('Canva'), aBreachNamed('Dropbox')],
                total: 3,
                page: 2,
            },
            request: aCatalogRequest().forPage(2).build(),
        });

        expect(itemNames(next)).toStrictEqual(['Adobe', 'Canva', 'Dropbox']);
    });

    it('appends a page that repeats nothing', () => {
        const onScreen: ListState = {
            status: ListStatus.Ready,
            items: [aBreachNamed('Adobe')],
            total: 2,
            page: FIRST_PAGE,
        };

        const next = receivePage({
            current: onScreen,
            page: { items: [aBreachNamed('Canva')], total: 2, page: 2 },
            request: aCatalogRequest().forPage(2).build(),
        });

        expect(itemNames(next)).toStrictEqual(['Adobe', 'Canva']);
    });
});
