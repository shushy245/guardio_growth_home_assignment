// The design's funnel: a label and one bar per series for each step, the bars sized as a share of
// that series' first step. Native `meter` elements, so the width is data with no inline style and
// a screen reader gets a value, not a coloured box. The legend is always present (two series) and
// the bar's accessible name carries the number the colour alone would not.
import type { ReactElement } from 'react';

import { Column, Row } from '~/ui/box';
import { joinClassNames } from '~/ui/box.utils';
import {
    type FunnelBar,
    type FunnelBarsProps,
    FunnelBarsTestIds,
    funnelBarTestId,
    type FunnelSeries,
    hasTooManySeries,
    MAX_SERIES,
    toRows,
} from '~/charts/FunnelBars.utils';

import styles from '~/charts/FunnelBars.module.scss';

// Colour by position, never cycled: the first series is always `series1`.
const seriesClasses: readonly (string | undefined)[] = [styles.series1, styles.series2];

export const FunnelBars = ({ series }: FunnelBarsProps): ReactElement => {
    if (hasTooManySeries(series)) {
        throw new Error(`FunnelBars: ${series.length} series given, at most ${MAX_SERIES} can be drawn`);
    }

    return (
        <Column className={styles.chart} data-testid={FunnelBarsTestIds.Root}>
            {toRows(series).map((row) => (
                <Column key={row.key} className={styles.step}>
                    <span className={styles.label}>{row.label}</span>
                    <Column className={styles.bars}>
                        {row.bars.map((bar) => (
                            <Bar key={bar.seriesKey} bar={bar} />
                        ))}
                    </Column>
                </Column>
            ))}
            <Legend series={series} />
        </Column>
    );
};

const Bar = ({ bar }: { bar: FunnelBar }): ReactElement => (
    <meter
        className={joinClassNames(styles.bar, seriesClasses[bar.seriesIndex])}
        value={bar.share}
        min={0}
        max={1}
        aria-label={bar.name}
        data-testid={funnelBarTestId({ series: bar.seriesKey, step: bar.stepKey })}
    />
);

const Legend = ({ series }: { series: FunnelSeries[] }): ReactElement => (
    <Row className={styles.legend} data-testid={FunnelBarsTestIds.Legend}>
        {series.map((one, index) => (
            <Row key={one.key} className={styles.legendItem}>
                <span className={joinClassNames(styles.swatch, seriesClasses[index])} aria-hidden="true" />
                <span>{one.label}</span>
            </Row>
        ))}
    </Row>
);
