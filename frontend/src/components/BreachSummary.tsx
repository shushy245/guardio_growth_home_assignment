// The design's SummaryTile row: four reasons to care, each a number from the public record. A
// 2×2 grid of flex items at 390 and one row of four at 768+, by CSS only; skeleton tiles hold the
// space while the summary loads so the header never jumps when it lands.
import type { ReactElement } from 'react';

import { Column, Row } from '~/ui/box';
import { useCountUp } from '~/hooks/useCountUp';
import type { Tone } from '~/models/featureFlag';
import { useBreachCatalog } from '~/providers/BreachCatalogProvider';
import { isSummaryReady } from '~/providers/BreachCatalogProvider.utils';
import {
    BreachSummaryTestIds,
    buildSummaryTiles,
    countModeMap,
    formatSyncedLine,
    SUMMARY_TILE_COUNT,
    type SummaryTileModel,
    summaryTileTestId,
} from '~/components/BreachSummary.utils';

import styles from '~/components/BreachSummary.module.scss';

export const BreachSummary = ({ tone }: { tone: Tone }): ReactElement => {
    const { summary } = useBreachCatalog();
    // Counted from zero once the figure is known; zero until then, which the skeleton covers.
    const accountsExposed = useCountUp({
        target: isSummaryReady(summary) ? summary.summary.totalAccountsExposed : 0,
        mode: countModeMap[tone],
    });
    if (!isSummaryReady(summary)) return <SkeletonTiles />;

    return (
        <Column className={styles.summary}>
            <Row className={styles.tiles} data-testid={BreachSummaryTestIds.Tiles}>
                {buildSummaryTiles({ summary: summary.summary, accountsExposed }).map((tile) => (
                    <Tile key={tile.id} tile={tile} />
                ))}
            </Row>
            <span className={styles.synced} data-testid={BreachSummaryTestIds.Synced}>
                {formatSyncedLine({ syncedAt: summary.summary.syncedAt, now: new Date() })}
            </span>
        </Column>
    );
};

const Tile = ({ tile }: { tile: SummaryTileModel }): ReactElement => (
    <Column className={styles.tile} data-testid={summaryTileTestId(tile.id)}>
        <span className={styles.label}>{tile.label}</span>
        <span className={styles.value}>{tile.value}</span>
        {tile.support === undefined ? undefined : <span className={styles.support}>{tile.support}</span>}
    </Column>
);

const SkeletonTiles = (): ReactElement => (
    <Row className={styles.tiles} data-testid={BreachSummaryTestIds.Skeleton} aria-busy="true">
        {Array.from({ length: SUMMARY_TILE_COUNT }, (_, index) => (
            <Column key={index} className={styles.tile}>
                <span className={styles.skeletonLabel} />
                <span className={styles.skeletonValue} />
            </Column>
        ))}
    </Row>
);
