// The model's public API: what its data means, named. Call sites read these, never the fields.

import type { ExperimentResultModel, MeasuredExperimentResultModel } from '~/models/experimentResult/model';

// Both figures measured — the lift card has something to print. A type predicate, so the one
// check narrows the result and no consumer re-tests the two fields inline (S7 review, R-6).
export const hasStatistics = (result: ExperimentResultModel): result is MeasuredExperimentResultModel =>
    result.test !== undefined && result.lift !== undefined;

// The smaller arm has reached the sample the hypothesis was powered for. Until then the only
// honest banner is "keep running", whatever the p-value says (the peeking guard).
export const hasEnoughTraffic = (result: ExperimentResultModel): boolean =>
    result.sample.reachedPerArm >= result.sample.requiredPerArm;
