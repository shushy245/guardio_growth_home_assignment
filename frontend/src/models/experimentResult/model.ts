// Types and enums only — no logic. `translator.ts` builds these, `selectors.ts` reads them.

import type { FunnelEventName } from '~/models/funnelEvent';

// The values are the API's: each member is the string the backend's Recommendation enum emits.
export enum Recommendation {
    ShipVariant = 'SHIP_VARIANT',
    KeepControl = 'KEEP_CONTROL',
    KeepRunning = 'KEEP_RUNNING',
}

export type HypothesisModel = {
    statement: string;
    baselineRate: number;
    minimumDetectableRelativeLift: number;
};

// A conversion rate between two funnel steps: visitors at `numerator` over visitors at `denominator`.
export type MetricDefinitionModel = {
    numerator: FunnelEventName;
    denominator: FunnelEventName;
};

export type MetricDefinitionsModel = {
    primary: MetricDefinitionModel;
    secondary: MetricDefinitionModel;
    guardrail: MetricDefinitionModel;
};

export type StepCountModel = {
    name: FunnelEventName;
    visitors: number;
};

// `rate` is absent, not zero, when nobody reached the denominator: 0 of 0 is not a rate of 0.
export type MetricModel = {
    successes: number;
    trials: number;
    rate: number | undefined;
};

export type ArmModel = {
    key: string;
    // All six steps in funnel order, a step nobody reached at zero.
    steps: StepCountModel[];
    primary: MetricModel;
    secondary: MetricModel;
    guardrail: MetricModel;
};

export type ZTestModel = {
    // Signed: positive when the variant converted better than the control.
    z: number;
    pValue: number;
};

// A point estimate and the interval it is known to within, at the API's alpha.
export type EstimateModel = {
    point: number;
    low: number;
    high: number;
};

export type LiftModel = {
    // In rate points: 8% to 10% is +0.02.
    absolute: EstimateModel;
    // As a proportion of the control: the same move is +0.25.
    relative: EstimateModel;
};

export type SampleModel = {
    requiredPerArm: number;
    // The smaller arm's trials — how far the experiment has got towards `requiredPerArm`.
    reachedPerArm: number;
};

export type ExperimentResultModel = {
    flagKey: string;
    hypothesis: HypothesisModel;
    metrics: MetricDefinitionsModel;
    control: ArmModel;
    variant: ArmModel;
    // Absent independently of each other, as the API states them: an experiment can have a
    // valid z-test and no statable lift (a control nobody converted in). Optional here rather
    // than a variant field, because their presence is set by the data, not by another field.
    test: ZTestModel | undefined;
    lift: LiftModel | undefined;
    sample: SampleModel;
    recommendation: Recommendation;
};

// A result with both figures measured — what `hasStatistics` narrows to, so the lift card reads
// `test` and `lift` directly instead of re-checking each for absence.
export type MeasuredExperimentResultModel = ExperimentResultModel & { test: ZTestModel; lift: LiftModel };
