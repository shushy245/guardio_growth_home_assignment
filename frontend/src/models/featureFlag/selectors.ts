// The model's public API: what its data means, named. Call sites read these, never the fields.

import { WEIGHT_TOTAL } from '~/models/featureFlag/model';
import type { FeatureFlagModel, FeatureFlagVariantModel } from '~/models/featureFlag/model';

export const findVariant = (flag: FeatureFlagModel, variantKey: string): FeatureFlagVariantModel | undefined =>
    flag.variants.find((variant) => variant.key === variantKey);

export const findFlag = (flags: FeatureFlagModel[], flagKey: string): FeatureFlagModel | undefined =>
    flags.find((flag) => flag.key === flagKey);

// The weights must cover every one of the hundred buckets; the backend rejects anything else
// with a 400, so the editor can say so before the round trip.
export const totalWeight = (flag: FeatureFlagModel): number =>
    flag.variants.reduce((total, variant) => total + variant.weight, 0);

export const hasCompleteSplit = (flag: FeatureFlagModel): boolean => totalWeight(flag) === WEIGHT_TOTAL;
