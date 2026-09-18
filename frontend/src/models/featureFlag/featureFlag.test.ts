import { describe, expect, it } from 'vitest';

import { aFeatureFlagDTO } from '~/testkit/builders';
import { findVariant, fromDTO, Tone, toUpdatePayload } from '~/models/featureFlag';

describe('featureFlag.fromDTO', () => {
    it('keeps the lock token as the exact string the API sent', () => {
        // The token round-trips verbatim: a Date would drop the microseconds and turn every
        // honest save into a 409.
        const flag = fromDTO(aFeatureFlagDTO().withUpdatedAt('2026-09-18T08:00:00.123456Z').build());

        expect(flag.lockToken).toBe('2026-09-18T08:00:00.123456Z');
    });

    it('reads each variant tone as the enum member it names', () => {
        const flag = fromDTO(aFeatureFlagDTO().build());

        expect(flag.variants.map((variant) => variant.config.tone)).toStrictEqual([Tone.Calm, Tone.Urgent]);
    });
});

describe('featureFlag.toUpdatePayload', () => {
    it('sends the editable fields and the lock token, and nothing the server owns', () => {
        const dto = aFeatureFlagDTO().withUrgentCtaLabel('Protect me today').build();

        expect(toUpdatePayload(fromDTO(dto))).toStrictEqual({
            description: dto.description,
            isEnabled: dto.isEnabled,
            variants: dto.variants,
            updatedAt: dto.updatedAt,
        });
    });
});

describe('featureFlag selectors', () => {
    it('finds a variant by key', () => {
        const flag = fromDTO(aFeatureFlagDTO().build());

        expect(findVariant(flag, 'urgent')?.config.ctaLabel).toBe('Protect me now');
    });

    it('finds nothing for a variant key the flag does not have', () => {
        const flag = fromDTO(aFeatureFlagDTO().build());

        expect(findVariant(flag, 'nope')).toBeUndefined();
    });
});
