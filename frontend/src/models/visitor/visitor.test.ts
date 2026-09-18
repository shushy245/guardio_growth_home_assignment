import { describe, expect, it } from 'vitest';

import { aVisitorDTO } from '~/testkit/builders';
import { assignedVariantKey, fromDTO } from '~/models/visitor';

describe('visitor.fromDTO', () => {
    it('carries the id and the assignments through', () => {
        const visitor = fromDTO(aVisitorDTO().withId('vis_1').assignedTo('result_screen_tone', 'calm').build());

        expect(visitor.id).toBe('vis_1');
        expect(assignedVariantKey(visitor, 'result_screen_tone')).toBe('calm');
    });

    it('reads a flag the visitor was never assigned to as undefined', () => {
        const visitor = fromDTO(aVisitorDTO().withoutAssignments().build());

        expect(assignedVariantKey(visitor, 'result_screen_tone')).toBeUndefined();
    });
});
