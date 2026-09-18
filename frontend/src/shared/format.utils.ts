// Number formatting for the screen. Pure, and the one home for how a count reads: a tile, a row's
// meta line and the results line must agree on what 17,816,217,392 looks like.

const THOUSAND = 1_000;
const ONE_DECIMAL = 10;

type Magnitude = { floor: number; suffix: string };

// Largest first: the first magnitude the count reaches is the one it is written in.
const magnitudes: readonly Magnitude[] = [
    { floor: THOUSAND ** 3, suffix: 'B' },
    { floor: THOUSAND ** 2, suffix: 'M' },
    { floor: THOUSAND, suffix: 'K' },
];

const toOneDecimal = (value: number): string => String(Math.round(value * ONE_DECIMAL) / ONE_DECIMAL);

// `17.8B`, `14.9M`, `412K`, `950`: one decimal, and none when it would be a zero.
export const formatCount = (count: number): string => {
    const magnitude = magnitudes.find((candidate) => count >= candidate.floor);
    if (magnitude === undefined) return String(count);

    return `${toOneDecimal(count / magnitude.floor)}${magnitude.suffix}`;
};

// `1,036`: the exact figure with its thousands grouped, for a line that states a total.
export const formatInteger = (value: number): string => value.toLocaleString('en-US');

// `65%` from a share of one.
export const formatShare = (share: number): string => `${Math.round(share * 100)}%`;
