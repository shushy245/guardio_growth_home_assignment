import { describe, expect, it } from 'vitest';

import { aVisitorState } from '~/testkit/builders';
import { variantFor } from '~/providers/VisitorProvider.utils';

const RESULT_SCREEN_TONE = 'result_screen_tone';

describe('variantFor', () => {
    it('reads the variant a ready visitor holds for the flag', () => {
        const state = aVisitorState().assignedTo({ flagKey: RESULT_SCREEN_TONE, variantKey: 'urgent' }).build();

        expect(variantFor(state, RESULT_SCREEN_TONE)?.key).toBe('urgent');
    });

    it('answers nothing for a flag the list does not hold', () => {
        // The guard nothing pinned (BF84). A visitor can hold an assignment to a flag that has
        // since been retired or renamed; without the guard the variant lookup runs against a
        // flag that is not there and the result screen throws where it should read control.
        const state = aVisitorState().assignedTo({ flagKey: 'checkout_button_colour', variantKey: 'green' }).build();

        expect(variantFor(state, 'checkout_button_colour')).toBeUndefined();
    });

    it('answers nothing while the session is loading and after it failed', () => {
        expect(variantFor(aVisitorState().stillLoading().build(), RESULT_SCREEN_TONE)).toBeUndefined();
        expect(variantFor(aVisitorState().failed().build(), RESULT_SCREEN_TONE)).toBeUndefined();
    });
});
