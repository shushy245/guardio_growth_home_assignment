// Immutable updates: every function returns a new flag and never touches the one it was given.
// The admin editor holds the edited copy in React state, so a mutation here would rewrite a
// value an earlier render already handed out.

import type { FeatureFlagModel, FeatureFlagVariantModel } from '~/models/featureFlag/model';

// The three copy fields an operator can edit. An enum rather than a free string so a field the
// model does not have cannot reach a text input.
export enum CopyField {
    Headline = 'headline',
    Subheadline = 'subheadline',
    CtaLabel = 'ctaLabel',
}

const mapVariant = (
    flag: FeatureFlagModel,
    variantKey: string,
    change: (variant: FeatureFlagVariantModel) => FeatureFlagVariantModel,
): FeatureFlagModel => ({
    ...flag,
    variants: flag.variants.map((variant) => (variant.key === variantKey ? change(variant) : variant)),
});

export const setVariantCopy = (
    flag: FeatureFlagModel,
    { variantKey, field, value }: { variantKey: string; field: CopyField; value: string },
): FeatureFlagModel =>
    mapVariant(flag, variantKey, (variant) => ({ ...variant, config: { ...variant.config, [field]: value } }));

export const setVariantWeight = (
    flag: FeatureFlagModel,
    { variantKey, weight }: { variantKey: string; weight: number },
): FeatureFlagModel => mapVariant(flag, variantKey, (variant) => ({ ...variant, weight }));

// Two states, one verb: `setEnabled(flag, true)` would be the banned boolean parameter, and at
// the call site `true` says nothing about what it turns on.
export const toggleEnabled = (flag: FeatureFlagModel): FeatureFlagModel => ({ ...flag, isEnabled: !flag.isEnabled });

export const setLockToken = (flag: FeatureFlagModel, lockToken: string): FeatureFlagModel => ({ ...flag, lockToken });

export const replaceFlag = (flags: FeatureFlagModel[], updated: FeatureFlagModel): FeatureFlagModel[] =>
    flags.map((flag) => (flag.key === updated.key ? updated : flag));
