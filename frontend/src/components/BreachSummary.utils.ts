// The summary tiles' testable surface: their ids, and the pure step from the summary model to the
// four tiles the screen shows. The component file exports only the component.

import type { BreachSummaryModel } from '~/models/breach';
import { formatCount, formatShare } from '~/shared/format.utils';

// A test id is its own access path (docs/testing-conventions.md §test ids): the string in the DOM
// is exactly what you grep for to find the code that renders it.
export enum BreachSummaryTestIds {
    Tiles = 'BreachSummaryTestIds.Tiles',
    Skeleton = 'BreachSummaryTestIds.Skeleton',
}

// The four reasons to care, in the order the design shows them.
export enum SummaryTile {
    RecentBreaches = 'RecentBreaches',
    AccountsExposed = 'AccountsExposed',
    PasswordsLeaked = 'PasswordsLeaked',
    LargestBreach = 'LargestBreach',
}

export const summaryTileTestId = (tile: SummaryTile): string => `BreachSummaryTestIds.Tile.${tile}`;

export type SummaryTileModel = {
    id: SummaryTile;
    label: string;
    value: string;
    // A second line under the value; only the largest breach has one (deviation 4: the tile
    // names the breach and carries its count beneath).
    support?: string | undefined;
};

export const SUMMARY_TILE_COUNT = 4;

export const buildSummaryTiles = (summary: BreachSummaryModel): SummaryTileModel[] => [
    { id: SummaryTile.RecentBreaches, label: 'Breaches, last 12 months', value: String(summary.breachesLast12Months) },
    { id: SummaryTile.AccountsExposed, label: 'Accounts exposed', value: formatCount(summary.totalAccountsExposed) },
    { id: SummaryTile.PasswordsLeaked, label: 'Passwords leaked', value: formatShare(summary.shareExposingPasswords) },
    {
        id: SummaryTile.LargestBreach,
        label: 'Largest breach',
        value: summary.largestBreach.title,
        support: `${formatCount(summary.largestBreach.pwnCount)} accounts`,
    },
];
