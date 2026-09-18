// The summary tiles' testable surface: their ids, and the pure step from the summary model to the
// four tiles the screen shows. The component file exports only the component.

import { Tone } from '~/models/featureFlag';
import { CountMode } from '~/hooks/useCountUp';
import type { BreachSummaryModel } from '~/models/breach';
import { formatCount, formatShare, formatSyncedAgo } from '~/shared/format.utils';

// A test id is its own access path (docs/testing-conventions.md §test ids): the string in the DOM
// is exactly what you grep for to find the code that renders it.
export enum BreachSummaryTestIds {
    Tiles = 'BreachSummaryTestIds.Tiles',
    Skeleton = 'BreachSummaryTestIds.Skeleton',
    Synced = 'BreachSummaryTestIds.Synced',
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

// Only the urgent framing counts the exposed accounts up (the design's one counting number); the
// calm framing states it. A lookup so a third tone chooses here, not in a branch.
export const countModeMap: Record<Tone, CountMode> = {
    [Tone.Calm]: CountMode.Still,
    [Tone.Urgent]: CountMode.CountUp,
};

// `accountsExposed` arrives separately because it may be mid-count; every other value is read
// straight from the summary.
export const buildSummaryTiles = ({
    summary,
    accountsExposed,
}: {
    summary: BreachSummaryModel;
    accountsExposed: number;
}): SummaryTileModel[] => [
    { id: SummaryTile.RecentBreaches, label: 'Breaches, last 12 months', value: String(summary.breachesLast12Months) },
    { id: SummaryTile.AccountsExposed, label: 'Accounts exposed', value: formatCount(accountsExposed) },
    { id: SummaryTile.PasswordsLeaked, label: 'Passwords leaked', value: formatShare(summary.shareExposingPasswords) },
    {
        id: SummaryTile.LargestBreach,
        label: 'Largest breach',
        value: summary.largestBreach.title,
        support: `${formatCount(summary.largestBreach.pwnCount)} accounts`,
    },
];

export const formatSyncedLine = ({ syncedAt, now }: { syncedAt: Date; now: Date }): string =>
    `Record synced ${formatSyncedAgo({ syncedAt, now })}`;
