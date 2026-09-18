// Prefixed ids minted in the browser: `evt_` + a UUID. The prefix names the entity in a log line
// or a database row, as the backend's `generate_unique_id` does. The body is a UUID rather than
// the backend's ULID because a client-minted id has no sort consumer — `occurredAt` orders
// events — and Web Crypto is the standard library.
//
// `crypto.randomUUID` exists only in a secure context: https and localhost. On plain http to any
// other host the browser leaves it undefined while `lib.dom` still types it as present, so this
// is the one seam that has to look before it calls — a throw here would happen during a render.
type MintUUID = () => string;

const UUID_VERSION_INDEX = 6;
const UUID_VARIANT_INDEX = 8;
const UUID_BYTES = 16;
const HEX_RADIX = 16;
const HEX_BYTE_WIDTH = 2;
const UUID_GROUPS: readonly [number, number][] = [
    [0, 8],
    [8, 12],
    [12, 16],
    [16, 20],
    [20, 32],
];

// RFC 4122 §4.4: the version nibble reads 4, the variant's top bits read 10.
const stampVersion = (byte: number): number => (byte & 0x0f) | 0x40;
const stampVariant = (byte: number): number => (byte & 0x3f) | 0x80;
const uuidByteStampMap: Record<number, (byte: number) => number> = {
    [UUID_VERSION_INDEX]: stampVersion,
    [UUID_VARIANT_INDEX]: stampVariant,
};
const asIs = (byte: number): number => byte;

const uuidFromRandomBytes = (): string => {
    const bytes = crypto.getRandomValues(new Uint8Array(UUID_BYTES));
    const hex = Array.from(bytes, (byte, index) =>
        (uuidByteStampMap[index] ?? asIs)(byte).toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, '0'),
    ).join('');

    return UUID_GROUPS.map(([from, to]) => hex.slice(from, to)).join('-');
};

// `WebCrypto` says what the platform actually promises — `randomUUID` may be absent — where
// `Crypto` claims it never is. Reading `crypto` through it is what makes the guard a real check
// rather than a condition the type system would call unnecessary. Called on the object, not
// detached: the native method checks its receiver.
type WebCrypto = { randomUUID?: MintUUID | undefined };

const mintUUID = (): string => {
    const webCrypto: WebCrypto = crypto;
    if (webCrypto.randomUUID === undefined) return uuidFromRandomBytes();

    return webCrypto.randomUUID();
};

export const generateUniqueId = (prefix: string): string => `${prefix}_${mintUUID()}`;
