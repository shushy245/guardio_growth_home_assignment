// Builders for the feature-flag wire shapes. Defaults are the seeded `result_screen_tone` flag.
//
// `with*` reassigns `this.state` to a fresh object and never mutates it in place: `build()`
// hands back the live object, so an in-place mutation would silently rewrite a DTO a previous
// `build()` already returned.

import type { FeatureFlagDTO, FeatureFlagVariantDTO } from '~/models/featureFlag';

const CALM: FeatureFlagVariantDTO = {
    key: 'calm',
    weight: 50,
    config: {
        headline: 'Known breaches',
        subheadline: "Here's the public record of data breaches.",
        ctaLabel: 'Protect me',
        tone: 'calm',
    },
};

const URGENT: FeatureFlagVariantDTO = {
    key: 'urgent',
    weight: 50,
    config: {
        headline: "You're exposed!",
        subheadline: '17.7B accounts have leaked. Yours could be among them.',
        ctaLabel: 'Protect me now',
        tone: 'urgent',
    },
};

const RESULT_SCREEN_TONE: FeatureFlagDTO = {
    key: 'result_screen_tone',
    description: 'Tone of the result screen: calm framing vs urgent framing of the same data.',
    isEnabled: true,
    variants: [CALM, URGENT],
    createdAt: '2026-09-18T08:00:00Z',
    updatedAt: '2026-09-18T08:00:00.123456Z',
};

class FeatureFlagDTOBuilder {
    private state: FeatureFlagDTO = { ...RESULT_SCREEN_TONE };

    withKey(key: string): this {
        this.state = { ...this.state, key };

        return this;
    }

    withUpdatedAt(updatedAt: string): this {
        this.state = { ...this.state, updatedAt };

        return this;
    }

    disabled(): this {
        this.state = { ...this.state, isEnabled: false };

        return this;
    }

    withUrgentCtaLabel(ctaLabel: string): this {
        this.state = {
            ...this.state,
            variants: this.state.variants.map((variant) =>
                variant.key === 'urgent' ? { ...variant, config: { ...variant.config, ctaLabel } } : variant,
            ),
        };

        return this;
    }

    build(): FeatureFlagDTO {
        return this.state;
    }
}

export const aFeatureFlagDTO = (): FeatureFlagDTOBuilder => new FeatureFlagDTOBuilder();
