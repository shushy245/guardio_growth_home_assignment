// The model's public API: what its data means, named. Call sites read these, never the fields.

import type { FeatureFlagModel, FeatureFlagVariantModel } from '~/models/featureFlag/model';

export const findVariant = (flag: FeatureFlagModel, variantKey: string): FeatureFlagVariantModel | undefined =>
    flag.variants.find((variant) => variant.key === variantKey);

export const findFlag = (flags: FeatureFlagModel[], flagKey: string): FeatureFlagModel | undefined =>
    flags.find((flag) => flag.key === flagKey);
