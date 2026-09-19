// The model's public API: what its data means, named. Call sites read these, never the fields.

import type { ExperimentResultModel } from '~/models/experimentResult/model';

// Both figures measured — the lift card has something to print.
export const hasStatistics = (result: ExperimentResultModel): boolean =>
    result.test !== undefined && result.lift !== undefined;

// The smaller arm has reached the sample the hypothesis was powered for. Until then the only
// honest banner is "keep running", whatever the p-value says (the peeking guard).
export const hasEnoughTraffic = (result: ExperimentResultModel): boolean =>
    result.sample.reachedPerArm >= result.sample.requiredPerArm;
