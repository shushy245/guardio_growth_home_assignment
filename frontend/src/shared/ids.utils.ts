// Prefixed ids minted in the browser: `evt_` + a UUID from Web Crypto. The prefix names the entity
// in a log line or a database row, as the backend's `generate_unique_id` does. The body is a UUID
// rather than the backend's ULID because a client-minted id has no sort consumer — `occurredAt`
// orders events — and `crypto.randomUUID()` is the standard library.
export const generateUniqueId = (prefix: string): string => `${prefix}_${crypto.randomUUID()}`;
