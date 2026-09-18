import { describe, expect, it } from 'vitest';

import { generateUniqueId } from '~/shared/ids.utils';

// The browser's absence, reproduced: an own property shadows the platform's `randomUUID` for the
// call and is removed after, so the tests around this one still see the real Web Crypto.
const withoutRandomUUID = <T>(run: () => T): T => {
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    try {
        return run();
    } finally {
        Reflect.deleteProperty(crypto, 'randomUUID');
    }
};

describe('generateUniqueId', () => {
    it('prefixes a UUID body with the entity name', () => {
        expect(generateUniqueId('evt')).toMatch(/^evt_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('still mints a UUID body where crypto.randomUUID does not exist', () => {
        // `randomUUID` is secure-context-only: on plain http to anything but localhost the browser
        // leaves it undefined, and this is the one seam that must not throw during a render.
        const id = withoutRandomUUID(() => generateUniqueId('evt'));

        expect(id).toMatch(/^evt_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('never mints the same id twice', () => {
        const ids = Array.from({ length: 1000 }, () => generateUniqueId('evt'));

        expect(new Set(ids).size).toBe(ids.length);
    });
});
