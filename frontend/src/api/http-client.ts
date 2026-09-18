// The one place axios is imported. Everything else imports httpClient from here.
import axios from 'axios';

import { isPlainObject, normaliseNulls } from '~/api/http-client.utils';

export const httpClient = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

httpClient.interceptors.response.use((response) => {
    response.data = normaliseNulls(response.data);

    return response;
});

// A request the caller abandoned by aborting its signal. Not a failure: the caller no longer
// wants the answer, so there is nothing to show and nothing to log.
export const isCancelled = (error: unknown): boolean => axios.isCancel(error);

// The status behind a failed request, or undefined when it never got an answer (network, abort).
export const statusOfError = (error: unknown): number | undefined => {
    if (!axios.isAxiosError(error)) return undefined;
    if (error.response === undefined) return undefined;

    return error.response.status;
};

// The house `{ error }` message when the server sent one, otherwise whatever the failure says.
export const describeError = (error: unknown): string => {
    if (axios.isAxiosError(error) && error.response !== undefined) {
        const body: unknown = error.response.data;
        if (isPlainObject(body) && typeof body['error'] === 'string') return body['error'];

        return `request failed with status ${error.response.status}`;
    }
    if (error instanceof Error) return error.message;

    return 'request failed';
};
