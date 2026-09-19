import { describe, expect, it } from 'vitest';

import { Plan } from '~/models/signup';
import { isProtectedRouteState } from '~/pages/Protected.utils';

describe('isProtectedRouteState', () => {
    it('recognises the state a sign-up navigates with', () => {
        expect(isProtectedRouteState({ plan: Plan.Family })).toBe(true);
        expect(isProtectedRouteState({ plan: Plan.Basic })).toBe(true);
    });

    it('refuses a visit carrying nothing, which is what a bookmark or a new tab carries', () => {
        expect(isProtectedRouteState(undefined)).toBe(false);
        expect(isProtectedRouteState({})).toBe(false);
    });

    it('refuses a plan the product does not offer', () => {
        expect(isProtectedRouteState({ plan: 'enterprise' })).toBe(false);
    });

    it('refuses an array, which reads its indices as keys', () => {
        // `isPlainObject`'s `!Array.isArray` clause is load-bearing only here: `['plan']` has no
        // `plan` key so it would fail anyway, but an array carrying one does not, and without
        // the clause the page would render a confirmation for state nothing sent it.
        expect(isProtectedRouteState([Plan.Family])).toBe(false);
        expect(isProtectedRouteState(Object.assign([], { plan: Plan.Family }))).toBe(false);
    });
});
