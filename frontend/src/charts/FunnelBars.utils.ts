// The funnel chart's contract and its testable surface. Chart-library-agnostic on purpose
// (docs/plan.md, S7 design call 2): a series is labels and numbers, and nothing here knows how
// the bars are drawn, so a later library-drawn chart is a new file in this folder rather than
// an edit to the page that feeds it.

import { formatInteger } from '~/shared/format.utils';

// A test id is its own access path (docs/testing-conventions.md §test ids): the string in the DOM
// is exactly what you grep for to find the code that renders it.
export enum FunnelBarsTestIds {
    Root = 'FunnelBarsTestIds.Root',
    Legend = 'FunnelBarsTestIds.Legend',
}

export const funnelBarTestId = ({ series, step }: { series: string; step: string }): string =>
    `FunnelBarsTestIds.Bar.${series}.${step}`;

export type FunnelStep = {
    key: string;
    label: string;
    value: number;
};

export type FunnelSeries = {
    key: string;
    label: string;
    steps: FunnelStep[];
};

export type FunnelBarsProps = {
    // Every series carries the same steps in the same order; the chart draws one row per step
    // of the first series and one bar per series inside it.
    series: FunnelSeries[];
};

// Two series, two colours, in fixed order (dataviz: hues are assigned by position, never
// cycled). A third series has no colour and is refused rather than drawn in one of the two.
export const MAX_SERIES = 2;

// Each step as a share of the first, so the first bar is always full and the shape of the
// funnel is what the eye reads. Nobody at the first step is an empty funnel, not a division.
export const shareOfFirst = (values: number[]): number[] => {
    const first = values[0] ?? 0;
    if (first === 0) return values.map(() => 0);

    return values.map((value) => value / first);
};

export const describeBar = ({
    seriesLabel,
    stepLabel,
    value,
}: {
    seriesLabel: string;
    stepLabel: string;
    value: number;
}): string => `${seriesLabel}, ${stepLabel}: ${formatInteger(value)} visitors`;

export const hasTooManySeries = (series: FunnelSeries[]): boolean => series.length > MAX_SERIES;

// One bar, ready to draw: which series it belongs to (by position, for its colour), its share of
// that series' first step, and the name a screen reader hears.
export type FunnelBar = {
    seriesKey: string;
    seriesIndex: number;
    stepKey: string;
    share: number;
    name: string;
};

// One row of the chart: a step's label and one bar per series.
export type FunnelRow = {
    key: string;
    label: string;
    bars: FunnelBar[];
};

const barsOf = (series: FunnelSeries, seriesIndex: number): FunnelBar[] => {
    const shares = shareOfFirst(series.steps.map((step) => step.value));

    return series.steps.map((step, stepIndex) => ({
        seriesKey: series.key,
        seriesIndex,
        stepKey: step.key,
        share: shares[stepIndex] ?? 0,
        name: describeBar({ seriesLabel: series.label, stepLabel: step.label, value: step.value }),
    }));
};

// The render model, computed once: the rows are the first series' steps, and each row holds the
// bar every series has at that position. A series shorter than the first simply has no bar in
// the rows past its end.
export const toRows = (series: FunnelSeries[]): FunnelRow[] => {
    const first = series[0];
    if (first === undefined) return [];
    const barsBySeries = series.map(barsOf);

    return first.steps.map((step, stepIndex) => ({
        key: step.key,
        label: step.label,
        bars: barsBySeries.flatMap((bars) => {
            const bar = bars[stepIndex];

            return bar === undefined ? [] : [bar];
        }),
    }));
};
