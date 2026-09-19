// The banner's testable surface: its ids, the class each call wears, and the pure step from the
// result to the sentence the banner prints. The component file exports only the component.

import { formatInteger } from '~/shared/format.utils';
import { type ExperimentResultModel, hasEnoughTraffic, Recommendation } from '~/models/experimentResult';

// A test id is its own access path (docs/testing-conventions.md §test ids): the string in the DOM
// is exactly what you grep for to find the code that renders it.
export enum RecommendationBannerTestIds {
    Root = 'RecommendationBannerTestIds.Root',
    Progress = 'RecommendationBannerTestIds.Progress',
}

// The three tones the banner can take, as the class names the stylesheet keys on. An enum so
// the component maps a recommendation to one of them and never spells a class inline.
export enum BannerClass {
    Ship = 'ship',
    Stop = 'stop',
    Wait = 'wait',
}

export const bannerClassMap: Record<Recommendation, BannerClass> = {
    [Recommendation.ShipVariant]: BannerClass.Ship,
    [Recommendation.KeepControl]: BannerClass.Stop,
    [Recommendation.KeepRunning]: BannerClass.Wait,
};

const formatKeepRunning = (result: ExperimentResultModel): string => {
    if (hasEnoughTraffic(result)) return 'Keep running — no significant difference yet';
    const { reachedPerArm, requiredPerArm } = result.sample;

    return `Keep running — ${formatInteger(reachedPerArm)} of ${formatInteger(requiredPerArm)} required per arm`;
};

const bannerTitleMap: Record<Recommendation, (result: ExperimentResultModel) => string> = {
    [Recommendation.ShipVariant]: (result): string =>
        `Ship variant — ${result.variant.key} outperforms ${result.control.key} with high confidence`,
    [Recommendation.KeepControl]: (result): string =>
        `Keep control — ${result.variant.key} underperforms ${result.control.key} with high confidence`,
    [Recommendation.KeepRunning]: formatKeepRunning,
};

export const formatBannerTitle = (result: ExperimentResultModel): string =>
    bannerTitleMap[result.recommendation](result);

// The sample bar is drawn only while the sample is what the experiment is waiting for: once the
// smaller arm has reached it, the wait is for a signal, and a full bar would say otherwise.
export const showsSampleProgress = (result: ExperimentResultModel): boolean =>
    result.recommendation === Recommendation.KeepRunning && !hasEnoughTraffic(result);
