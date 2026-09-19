// The lift card's testable surface: its ids, how a lift and a p-value are written, and the pure
// step from the result to what the card prints. The component file exports only the component.

import { labelOfStep } from '~/shared/funnel-steps.utils';
import { type ExperimentResultModel, hasStatistics } from '~/models/experimentResult';

// A test id is its own access path (docs/testing-conventions.md §test ids): the string in the DOM
// is exactly what you grep for to find the code that renders it.
export enum LiftCardTestIds {
    Root = 'LiftCardTestIds.Root',
    Value = 'LiftCardTestIds.Value',
    Interval = 'LiftCardTestIds.Interval',
}

const PERCENT = 100;
const ONE_DECIMAL = 10;
const P_VALUE_DECIMALS = 3;
const P_VALUE_FLOOR = 0.001;
// The design's confidence level, stated on the line; the API computes the interval at it.
const CONFIDENCE_LABEL = '95% CI';

export const NO_DATA_VALUE = '—';
export const NO_DATA_LINE = 'Not enough data yet';

// `+25.0%`, `−5.6%`, `0.0%`: a real minus sign, and the sign decided on the rounded figure so a
// lift that rounds to zero is not written as `−0.0%`.
export const formatSignedPercent = (share: number): string => {
    const rounded = Math.round(share * PERCENT * ONE_DECIMAL) / ONE_DECIMAL;
    const magnitude = `${Math.abs(rounded).toFixed(1)}%`;
    if (rounded > 0) return `+${magnitude}`;
    if (rounded < 0) return `−${magnitude}`;

    return magnitude;
};

// `p = 0.118`; below the floor, `p < 0.001` rather than a string of zeros nobody can read.
export const formatPValue = (pValue: number): string =>
    pValue < P_VALUE_FLOOR ? `p < ${P_VALUE_FLOOR}` : `p = ${pValue.toFixed(P_VALUE_DECIMALS)}`;

export enum LiftDirection {
    Up = 'up',
    Down = 'down',
    Flat = 'flat',
}

const directionOf = (point: number): LiftDirection => {
    if (point > 0) return LiftDirection.Up;
    if (point < 0) return LiftDirection.Down;

    return LiftDirection.Flat;
};

export enum LiftReadKind {
    Measured = 'measured',
    Unmeasured = 'unmeasured',
}

// What the card prints, as a variant: a measured lift has a figure, a line and a direction; an
// unmeasured one has only the placeholders, so no render can print `undefined%`.
export type LiftRead =
    | { kind: LiftReadKind.Measured; value: string; line: string; direction: LiftDirection }
    | { kind: LiftReadKind.Unmeasured };

export const isMeasured = (read: LiftRead): read is Extract<LiftRead, { kind: LiftReadKind.Measured }> =>
    read.kind === LiftReadKind.Measured;

export const readLift = (result: ExperimentResultModel): LiftRead => {
    if (!hasStatistics(result)) return { kind: LiftReadKind.Unmeasured };
    const { relative } = result.lift;

    return {
        kind: LiftReadKind.Measured,
        value: formatSignedPercent(relative.point),
        line: `${CONFIDENCE_LABEL} ${formatSignedPercent(relative.low)} to ${formatSignedPercent(relative.high)} · ${formatPValue(result.test.pValue)}`,
        direction: directionOf(relative.point),
    };
};

// `Lift on activation`: the primary metric's numerator, the step the hypothesis is stated on.
export const formatLiftTitle = (result: ExperimentResultModel): string =>
    `Lift on ${labelOfStep(result.metrics.primary.numerator).toLowerCase()}`;
