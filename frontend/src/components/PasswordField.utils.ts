// The password field's testable surface: its ids and copy, the check's state machine, and the
// pure steps of the k-anonymity protocol — hash, split, look up. The component file exports only
// the component; the hook that runs the check is `hooks/usePasswordLeakCheck.ts`.

// A test id is its own access path (docs/testing-conventions.md §test ids): the string in the DOM
// is exactly what you grep for to find the code that renders it.
export enum PasswordFieldTestIds {
    Input = 'PasswordFieldTestIds.Input',
    Checking = 'PasswordFieldTestIds.Checking',
    Leaked = 'PasswordFieldTestIds.Leaked',
    Unchecked = 'PasswordFieldTestIds.Unchecked',
    Error = 'PasswordFieldTestIds.Error',
}

export const PASSWORD_LABEL = 'Password';
export const CHECKING_MESSAGE = 'Checking against known leaks…';
export const UNCHECKED_MESSAGE = "Couldn't check this password right now.";
// Mirrors the backend's floor for the inline message only; the backend is the boundary.
export const MIN_PASSWORD_LENGTH = 8;
export const PASSWORD_TOO_SHORT_MESSAGE = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;

// How long the visitor has to stop typing before a range is asked for. Long enough that a
// password costs one request, short enough that the answer lands before they reach the button.
export const PASSWORD_CHECK_DEBOUNCE_MS = 300;

export enum PasswordCheckStatus {
    Idle = 'idle',
    Checking = 'checking',
    Leaked = 'leaked',
    Clean = 'clean',
    // The check could not run: the proxy failed, or this browser has no Web Crypto. Never a
    // clean bill — the field says so, softly, and does not block.
    Unchecked = 'unchecked',
}

// A discriminated union keyed to the password it concerns: a result is only meaningful for the
// exact password that was checked, which is what lets the page tell a stale warning from a live one.
export type PasswordCheck =
    | { status: PasswordCheckStatus.Idle }
    | { status: PasswordCheckStatus.Checking; password: string }
    | { status: PasswordCheckStatus.Leaked; password: string; count: number }
    | { status: PasswordCheckStatus.Clean; password: string }
    | { status: PasswordCheckStatus.Unchecked; password: string };

export const IDLE_CHECK: PasswordCheck = { status: PasswordCheckStatus.Idle };

export const isLeaked = (
    check: PasswordCheck,
): check is Extract<PasswordCheck, { status: PasswordCheckStatus.Leaked }> =>
    check.status === PasswordCheckStatus.Leaked;

// What the sign-up sends: true only when the check finished, found a leak, and it was for the
// very password being submitted. A pending or failed check is not a leak, and a warning for a
// password since edited belongs to that earlier password.
export const wasPwned = ({ check, password }: { check: PasswordCheck; password: string }): boolean =>
    isLeaked(check) && check.password === password;

export const isTooShort = (password: string): boolean => password.length < MIN_PASSWORD_LENGTH;

// `aria-describedby` is a space-separated id list, and absent rather than empty when nothing
// describes the field: an attribute pointing at no element is one a screen reader reads as a
// missing description.
export const describedBy = (...ids: (string | undefined)[]): string | undefined => {
    const present = ids.filter((id): id is string => id !== undefined);

    return present.length === 0 ? undefined : present.join(' ');
};

export const leakedMessage = (count: number): string =>
    `This password appeared in ${count.toLocaleString('en-US')} leaks. You can still continue, but change it where you use it.`;

// --- the k-anonymity protocol, pure ---

const PREFIX_LENGTH = 5;
const HEX_RADIX = 16;
const HEX_BYTE_WIDTH = 2;

// `lib.dom` types `crypto.subtle` as always present; it is undefined on plain http off localhost
// (the S4 finding for `randomUUID`). Reading it through this type makes the guard a real check.
type WebCrypto = { subtle?: SubtleCrypto | undefined };

// SHA-1, upper-case hex — the spelling the range API uses. Never stored: it is a lookup key for
// the leak check, not a credential (ADR-0005). Throws when this browser cannot hash, and the
// caller turns that into "couldn't check".
export const sha1Hex = async (password: string): Promise<string> => {
    const webCrypto: WebCrypto = crypto;
    if (webCrypto.subtle === undefined) throw new Error('sha1Hex: Web Crypto is unavailable in this context');
    const digest = await webCrypto.subtle.digest('SHA-1', new TextEncoder().encode(password));

    return Array.from(new Uint8Array(digest), (byte) => byte.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, '0'))
        .join('')
        .toUpperCase();
};

export const splitHash = (hashHex: string): { prefix: string; suffix: string } => ({
    prefix: hashHex.slice(0, PREFIX_LENGTH),
    suffix: hashHex.slice(PREFIX_LENGTH),
});

// The range is `SUFFIX:COUNT` lines. A suffix seen zero times is a padding line, not a leak.
export const findSuffixCount = ({ rangeText, suffix }: { rangeText: string; suffix: string }): number | undefined => {
    const line = rangeText.split(/\r?\n/).find((candidate) => candidate.startsWith(`${suffix}:`));
    if (line === undefined) return undefined;
    const count = Number(line.slice(suffix.length + 1));
    if (!Number.isInteger(count) || count <= 0) return undefined;

    return count;
};
