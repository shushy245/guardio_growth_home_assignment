// Types and enums only — no logic. `translator.ts` builds these, `selectors.ts` reads them.

// The values are the API's: each member is the string the backend's Tone enum emits.
export enum Tone {
    Calm = 'calm',
    Urgent = 'urgent',
}

export type VariantConfigModel = {
    headline: string;
    subheadline: string;
    ctaLabel: string;
    tone: Tone;
};

export type FeatureFlagVariantModel = {
    key: string;
    weight: number;
    config: VariantConfigModel;
};

export type FeatureFlagModel = {
    key: string;
    description: string;
    isEnabled: boolean;
    variants: FeatureFlagVariantModel[];
    createdAt: Date;
    // The optimistic-lock token, kept as the exact string the API sent. Not a Date: a JS Date
    // holds milliseconds, the token carries microseconds, and a re-serialised token would never
    // match what is stored — every honest save would be a 409.
    lockToken: string;
};

export const RESULT_SCREEN_TONE_FLAG = 'result_screen_tone';
