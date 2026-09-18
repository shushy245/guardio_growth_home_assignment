// Everything about the breach catalog's client state that is not React: the two state machines
// (summary and list), the request the provider's effect answers, and the predicates the pages
// read. The provider file owns the effects; this file owns what the states mean.

import type { BreachModel, BreachSummaryModel } from '~/models/breach';

export enum SummaryStatus {
    Idle = 'idle',
    Loading = 'loading',
    Ready = 'ready',
    Failed = 'failed',
}

// A discriminated union: the summary is only reachable once it has loaded, so no tile can render
// a zero while the request is in flight or after it failed.
export type SummaryState =
    | { status: SummaryStatus.Idle }
    | { status: SummaryStatus.Loading }
    | { status: SummaryStatus.Ready; summary: BreachSummaryModel }
    // Failed carries nothing: the detail is logged, and what the page shows is fixed copy.
    | { status: SummaryStatus.Failed };

export enum ListStatus {
    Idle = 'idle',
    Loading = 'loading',
    Ready = 'ready',
    Failed = 'failed',
}

export type ListState =
    | { status: ListStatus.Idle }
    | { status: ListStatus.Loading }
    | { status: ListStatus.Ready; items: BreachModel[]; total: number; page: number }
    | { status: ListStatus.Failed };

// What the provider's effect answers. `isEnabled` flips once, when the first consumer mounts;
// `attempt` advances on every retry so the same request runs again.
export type CatalogRequest = {
    isEnabled: boolean;
    attempt: number;
};

export const IDLE_REQUEST: CatalogRequest = { isEnabled: false, attempt: 0 };

export const isSummaryReady = (state: SummaryState): state is Extract<SummaryState, { status: SummaryStatus.Ready }> =>
    state.status === SummaryStatus.Ready;

export const hasSummaryFailed = (state: SummaryState): boolean => state.status === SummaryStatus.Failed;

export const isListReady = (state: ListState): state is Extract<ListState, { status: ListStatus.Ready }> =>
    state.status === ListStatus.Ready;

export const hasListFailed = (state: ListState): boolean => state.status === ListStatus.Failed;

// The scan moment ends only when both halves of the result screen can render.
export const isCatalogReady = ({ summary, list }: { summary: SummaryState; list: ListState }): boolean =>
    isSummaryReady(summary) && isListReady(list);

// Either half failing is the whole screen failing: a result page with tiles and no rows, or
// rows and no tiles, would be a half-answer presented as a whole one.
export const hasCatalogFailed = ({ summary, list }: { summary: SummaryState; list: ListState }): boolean =>
    hasSummaryFailed(summary) || hasListFailed(list);

export const enableRequest = (request: CatalogRequest): CatalogRequest =>
    request.isEnabled ? request : { ...request, isEnabled: true };

export const retryRequest = (request: CatalogRequest): CatalogRequest => ({
    isEnabled: true,
    attempt: request.attempt + 1,
});
