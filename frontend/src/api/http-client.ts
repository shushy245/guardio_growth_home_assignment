// The one place axios is imported. Everything else imports httpClient from here.
//
// **The signal convention for this whole directory**, so a new endpoint has a rule to follow
// rather than a neighbour to copy (BF70 found four files that stated it and four that did not):
//
//  - A read whose inputs change — filters, a page, a flag key — takes a **required**
//    `signal: AbortSignal`. Its caller owns an `AbortController` per effect and aborts it in the
//    cleanup, because an older request's answer is one nobody wants and the bytes are worth
//    cancelling. `fetchBreaches`, `fetchBreachSummary`, `fetchExperimentResults` and
//    `fetchPwnedRange` are these.
//  - A one-shot load at mount — the visitor session, the flag list — takes **no signal**, and is
//    called through `useLoadedState`, which holds the request in a ref so StrictMode's second
//    mount joins it. A signal here would cancel the request the surviving run is waiting for.
//  - A write from an event handler — a sign-up, a flag save, a funnel step — takes **no signal**:
//    nobody wants a POST the server may already have applied to be forgotten halfway, and a
//    funnel step aborted on navigation is a step the experiment never counts.
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
