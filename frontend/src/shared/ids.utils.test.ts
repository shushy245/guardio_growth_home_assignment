import { describe, expect, it } from 'vitest';

import { generateUniqueId } from '~/shared/ids.utils';

describe('generateUniqueId', () => {
    it('prefixes a UUID body with the entity name', () => {
        expect(generateUniqueId('evt')).toMatch(/^evt_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('never mints the same id twice', () => {
        const ids = Array.from({ length: 1000 }, () => generateUniqueId('evt'));

        expect(new Set(ids).size).toBe(ids.length);
    });
});
