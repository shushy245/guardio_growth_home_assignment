import { describe, expect, it } from 'vitest';

import { aFeatureFlagDTO } from '~/testkit/builders';
import {
    CopyField,
    findVariant,
    hasCompleteSplit,
    fromDTO,
    replaceFlag,
    setLockToken,
    setLockTokenIn,
    setVariantCopy,
    setVariantWeight,
    toggleEnabled,
    totalWeight,
    Tone,
    toUpdatePayload,
} from '~/models/featureFlag';

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

describe('featureFlag setters', () => {
    it('changes one variant’s cta label and leaves the other variant alone', () => {
        const flag = fromDTO(aFeatureFlagDTO().build());

        const edited = setVariantCopy(flag, {
            variantKey: 'urgent',
            field: CopyField.CtaLabel,
            value: 'Protect me today',
        });

        expect(findVariant(edited, 'urgent')?.config.ctaLabel).toBe('Protect me today');
        expect(findVariant(edited, 'calm')?.config.ctaLabel).toBe('Protect me');
    });

    it('leaves the flag it was given untouched', () => {
        // The editor holds the edited copy in state; mutating the original would rewrite the
        // value a previous render already handed out.
        const flag = fromDTO(aFeatureFlagDTO().build());

        setVariantCopy(flag, { variantKey: 'urgent', field: CopyField.Headline, value: 'Changed' });

        expect(findVariant(flag, 'urgent')?.config.headline).toBe("You're exposed!");
    });

    it('changes one variant’s weight', () => {
        const flag = fromDTO(aFeatureFlagDTO().build());

        const edited = setVariantWeight(flag, { variantKey: 'calm', weight: 70 });

        expect(findVariant(edited, 'calm')?.weight).toBe(70);
        expect(findVariant(edited, 'urgent')?.weight).toBe(50);
    });

    it('turns an enabled flag off and back on', () => {
        const flag = fromDTO(aFeatureFlagDTO().build());

        expect(toggleEnabled(flag).isEnabled).toBe(false);
        expect(toggleEnabled(toggleEnabled(flag)).isEnabled).toBe(true);
    });

    it('advances the lock token after a save', () => {
        const flag = fromDTO(aFeatureFlagDTO().withUpdatedAt('2026-09-18T08:00:00Z').build());

        expect(setLockToken(flag, '2026-09-18T09:00:00Z').lockToken).toBe('2026-09-18T09:00:00Z');
    });

    it('advances one flag’s lock token in a list and leaves the rest alone', () => {
        const first = fromDTO(aFeatureFlagDTO().withKey('a').withUpdatedAt('2026-09-18T08:00:00Z').build());
        const second = fromDTO(aFeatureFlagDTO().withKey('b').withUpdatedAt('2026-09-18T08:00:00Z').build());

        const advanced = setLockTokenIn([first, second], { flagKey: 'b', lockToken: '2026-09-18T09:00:00Z' });

        expect(advanced.map((flag) => flag.lockToken)).toStrictEqual(['2026-09-18T08:00:00Z', '2026-09-18T09:00:00Z']);
    });

    it('replaces one flag in a list by key and keeps the order', () => {
        const first = fromDTO(aFeatureFlagDTO().withKey('a').build());
        const second = fromDTO(aFeatureFlagDTO().withKey('b').build());

        const replaced = replaceFlag([first, second], toggleEnabled(second));

        expect(replaced.map((flag) => flag.key)).toStrictEqual(['a', 'b']);
        expect(replaced.find((flag) => flag.key === 'b')?.isEnabled).toBe(false);
    });
});

describe('featureFlag split', () => {
    it('adds the variant weights up', () => {
        expect(totalWeight(fromDTO(aFeatureFlagDTO().build()))).toBe(100);
    });

    it('says a split covering every bucket is complete', () => {
        expect(hasCompleteSplit(fromDTO(aFeatureFlagDTO().build()))).toBe(true);
    });

    it('says a split that leaves buckets unassigned is not complete', () => {
        const flag = setVariantWeight(fromDTO(aFeatureFlagDTO().build()), { variantKey: 'urgent', weight: 40 });

        expect(hasCompleteSplit(flag)).toBe(false);
    });
});
