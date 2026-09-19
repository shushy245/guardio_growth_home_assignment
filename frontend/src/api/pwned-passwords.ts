// The k-anonymity proxy. The browser asks for a five-character SHA-1 prefix and gets the range
// back as text; the lines are parsed by the caller (`findSuffixCount`), so there is no DTO here.
//
// The signal is required: the check re-runs as the visitor types and the answer to a password
// they have moved past is one nobody wants. The convention is written out in `http-client.ts`.
import { httpClient } from '~/api/http-client';

export const fetchPwnedRange = async ({ prefix, signal }: { prefix: string; signal: AbortSignal }): Promise<string> => {
    const response = await httpClient.get<string>(`/pwned-passwords/range/${encodeURIComponent(prefix)}`, {
        signal,
        responseType: 'text',
    });

    return response.data;
};
