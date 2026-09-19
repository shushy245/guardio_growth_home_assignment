import path from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { Tone } from '~/models/featureFlag';
import { toneClassMap } from '~/pages/Result.utils';

// Vitest does not compile CSS modules: the `styles` import echoes every key back as its own name,
// so `toneClassMap[tone]` is a string whether or not the stylesheet defines a rule for it. The
// stylesheet source is the only thing that can say, so the test reads it — a `.toneUrgent` rule
// that goes missing fails here instead of rendering the urgent variant calm. Read from disk:
// Vitest resolves the scss import to its CSS-modules stub before a `?raw` query can reach Vite.
const stylesheet = readFileSync(path.resolve(process.cwd(), 'src/pages/Result.module.scss'), 'utf8');

describe('toneClassMap', () => {
    it('names a rule the stylesheet defines for every tone', () => {
        Object.values(Tone).forEach((tone) => {
            const toneClass = toneClassMap[tone];
            expect(toneClass, `tone ${tone}`).toBeDefined();
            expect(stylesheet, `tone ${tone}`).toContain(`.${toneClass} {`);
        });
    });
});
