// Wire → model and model → wire. The DTO types are the API's shape and live here, so nothing
// else in the app ever sees a raw response body or builds a raw request body.

import { Tone } from '~/models/featureFlag/model';
import type { FeatureFlagModel, FeatureFlagVariantModel, VariantConfigModel } from '~/models/featureFlag/model';

export type VariantConfigDTO = {
    headline: string;
    subheadline: string;
    ctaLabel: string;
    tone: string;
};

export type FeatureFlagVariantDTO = {
    key: string;
    weight: number;
    config: VariantConfigDTO;
};

export type FeatureFlagDTO = {
    key: string;
    description: string;
    isEnabled: boolean;
    variants: FeatureFlagVariantDTO[];
    createdAt: string;
    updatedAt: string;
};

// What PATCH accepts: the editable fields plus the token. `key` and `createdAt` are the
// server's, and sending them is a 400 (`extra="forbid"` on the backend schema).
export type FeatureFlagUpdatePayload = {
    description: string;
    isEnabled: boolean;
    variants: FeatureFlagVariantDTO[];
    updatedAt: string;
};

export type FeatureFlagUpdatedDTO = {
    updatedAt: string;
};

const toneFromWire = (wire: string): Tone => {
    const tone = Object.values(Tone).find((member) => member === wire);
    if (tone === undefined) {
        throw new Error(
            `featureFlag.fromDTO: unknown tone ${JSON.stringify(wire)} — expected one of ${Object.values(Tone).join(', ')}`,
        );
    }

    return tone;
};

const configFromDTO = (dto: VariantConfigDTO): VariantConfigModel => ({ ...dto, tone: toneFromWire(dto.tone) });

export const variantFromDTO = (dto: FeatureFlagVariantDTO): FeatureFlagVariantModel => ({
    ...dto,
    config: configFromDTO(dto.config),
});

export const fromDTO = (dto: FeatureFlagDTO): FeatureFlagModel => ({
    key: dto.key,
    description: dto.description,
    isEnabled: dto.isEnabled,
    variants: dto.variants.map(variantFromDTO),
    createdAt: new Date(dto.createdAt),
    lockToken: dto.updatedAt,
});

const variantToDTO = (variant: FeatureFlagVariantModel): FeatureFlagVariantDTO => ({
    key: variant.key,
    weight: variant.weight,
    config: { ...variant.config },
});

export const toUpdatePayload = (flag: FeatureFlagModel): FeatureFlagUpdatePayload => ({
    description: flag.description,
    isEnabled: flag.isEnabled,
    variants: flag.variants.map(variantToDTO),
    updatedAt: flag.lockToken,
});

export const lockTokenFromDTO = (dto: FeatureFlagUpdatedDTO): string => dto.updatedAt;
