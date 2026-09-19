// The k-anonymity proxy. The browser asks for a five-character SHA-1 prefix and gets the range
// back as text; the lines are parsed by the caller (`findSuffixCount`), so there is no DTO here.
import { httpClient } from '~/api/http-client';

export const fetchPwnedRange = async ({ prefix, signal }: { prefix: string; signal: AbortSignal }): Promise<string> => {
    const response = await httpClient.get<string>(`/pwned-passwords/range/${encodeURIComponent(prefix)}`, {
        signal,
        responseType: 'text',
    });

    return response.data;
};
