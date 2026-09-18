import { describe, expect, it } from 'vitest';

import { Tone } from '~/models/featureFlag';
import { toneClassMap } from '~/pages/Result.utils';

describe('toneClassMap', () => {
    // The compiler proves every Tone has an entry; it cannot prove the entry names a class the
    // stylesheet defines — a missing `.toneUrgent` rule reads as `undefined` at runtime and the
    // urgent variant would render calm. This is the check for that.
    it('names a stylesheet class for every tone', () => {
        Object.values(Tone).forEach((tone) => {
            expect(toneClassMap[tone], `tone ${tone}`).toMatch(/^tone/);
        });
    });
});
