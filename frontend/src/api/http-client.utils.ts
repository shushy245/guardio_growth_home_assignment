// The boundary where JSON null becomes undefined: application code never sees null (house rule),
// so every response body passes through here before anything else reads it.
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export const normaliseNulls = (value: unknown): unknown => {
    if (value === null) return undefined;
    if (Array.isArray(value)) return value.map(normaliseNulls);
    if (isPlainObject(value))
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normaliseNulls(item)]));

    return value;
};
