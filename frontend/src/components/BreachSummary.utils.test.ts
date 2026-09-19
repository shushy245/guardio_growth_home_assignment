import { describe, expect, it } from 'vitest';

import { summaryFromDTO } from '~/models/breach';
import { aBreachSummaryDTO } from '~/testkit/builders';
import { buildSummaryTiles, SummaryTile, TileValueKind } from '~/components/BreachSummary.utils';

describe('buildSummaryTiles', () => {
    it('reads the largest breach as a name and every other tile as a number', () => {
        const summary = summaryFromDTO(aBreachSummaryDTO().build());
        const tiles = buildSummaryTiles({ summary, accountsExposed: summary.totalAccountsExposed });

        const kindOf = (id: SummaryTile): TileValueKind | undefined => tiles.find((tile) => tile.id === id)?.kind;
        expect(kindOf(SummaryTile.LargestBreach)).toBe(TileValueKind.Name);
        expect(kindOf(SummaryTile.RecentBreaches)).toBe(TileValueKind.Number);
        expect(kindOf(SummaryTile.AccountsExposed)).toBe(TileValueKind.Number);
        expect(kindOf(SummaryTile.PasswordsLeaked)).toBe(TileValueKind.Number);
    });
});
