// The one place axios is imported. Everything else imports httpClient from here.
import axios from 'axios';

export const httpClient = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

// JSON null becomes undefined at the boundary so application code never sees null.
const normaliseNulls = (value: unknown): unknown => {
    if (value === null) return undefined;
    if (Array.isArray(value)) return value.map(normaliseNulls);
    if (isPlainObject(value))
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normaliseNulls(v)]));

    return value;
};

httpClient.interceptors.response.use((response) => {
    response.data = normaliseNulls(response.data);

    return response;
});
