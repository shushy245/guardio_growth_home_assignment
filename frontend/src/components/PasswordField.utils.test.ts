import { describe, expect, it } from 'vitest';

import {
    findSuffixCount,
    isLeaked,
    PasswordCheckStatus,
    sha1Hex,
    splitHash,
    wasPwned,
} from '~/components/PasswordField.utils';

// The worked example from the Pwned Passwords documentation: SHA-1 of "password".
const PASSWORD_SHA1 = '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8';

describe('sha1Hex', () => {
    it('hashes a password to upper-case hex, as the range API spells its suffixes', async () => {
        expect(await sha1Hex('password')).toBe(PASSWORD_SHA1);
    });
});

describe('splitHash', () => {
    it('splits the five-character prefix the proxy is asked for from the suffix that never leaves', () => {
        expect(splitHash(PASSWORD_SHA1)).toStrictEqual({
            prefix: '5BAA6',
            suffix: '1E4C9B93F3F0682250B6CF8331B7EE68FD8',
        });
    });
});

describe('findSuffixCount', () => {
    const range = [
        '0018A45C4D1DEF81644B54AB7F969B88D65:1',
        '1E4C9B93F3F0682250B6CF8331B7EE68FD8:3120000',
        '2D1D5A3C3B3F3B3C3A3E3D3C3B3A39383736:0',
    ].join('\r\n');

    it('returns how often a suffix in the range was seen', () => {
        expect(findSuffixCount({ rangeText: range, suffix: '1E4C9B93F3F0682250B6CF8331B7EE68FD8' })).toBe(3120000);
    });

    it('returns undefined for a suffix the range does not list', () => {
        expect(findSuffixCount({ rangeText: range, suffix: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF' })).toBeUndefined();
    });

    it('treats a padded zero-count line as not seen', () => {
        // `Add-Padding` fills the answer with `:0` lines; a password seen zero times was not leaked.
        expect(findSuffixCount({ rangeText: range, suffix: '2D1D5A3C3B3F3B3C3A3E3D3C3B3A39383736' })).toBeUndefined();
    });
});

describe('wasPwned', () => {
    const leaked = { status: PasswordCheckStatus.Leaked, password: 'hunter22', count: 5 } as const;

    it('is true only for a leaked check of the very password being submitted', () => {
        expect(isLeaked(leaked)).toBe(true);
        expect(wasPwned({ check: leaked, password: 'hunter22' })).toBe(true);
    });

    it('is false when the password was edited after the check answered', () => {
        // The warning belongs to the password it checked, not to whatever is in the box now.
        expect(wasPwned({ check: leaked, password: 'hunter23' })).toBe(false);
    });

    it('is false for a check that is still running or could not run', () => {
        expect(
            wasPwned({ check: { status: PasswordCheckStatus.Checking, password: 'hunter22' }, password: 'hunter22' }),
        ).toBe(false);
        expect(
            wasPwned({ check: { status: PasswordCheckStatus.Unchecked, password: 'hunter22' }, password: 'hunter22' }),
        ).toBe(false);
    });
});
