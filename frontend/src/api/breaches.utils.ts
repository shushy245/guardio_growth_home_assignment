// Pure query-string construction for the breach endpoints. No axios, no React.

import type { BreachFilters } from '~/models/breach';

const isSet = (value: string | number | boolean | undefined): boolean => {
    if (value === undefined) return false;
    // `?q=` searches for the empty string and `?verifiedOnly=false` is the default the server
    // already applies — both are noise in the URL and in the browser's history.
    if (value === '') return false;

    return value !== false;
};

export const buildBreachesQuery = (filters: BreachFilters): string => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (isSet(value)) params.set(key, String(value));
    }
    const query = params.toString();

    return query === '' ? '' : `?${query}`;
};
