// Everything about the breach catalog's client state that is not React: the two state machines
// (summary and list), the request the provider's effect answers, and the predicates the pages
// read. The provider file owns the effects; this file owns what the states mean.

import type { BreachFilters, BreachModel, BreachSummaryModel } from '~/models/breach';

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
    // The first page of a selection: nothing to show yet, so the rows are skeletons.
    Loading = 'loading',
    Ready = 'ready',
    // A later page: what is already on screen stays, and the Load more button shows the wait.
    LoadingMore = 'loadingMore',
    Failed = 'failed',
}

export type LoadedList = { items: BreachModel[]; total: number; page: number };

export type ListState =
    | { status: ListStatus.Idle }
    | { status: ListStatus.Loading }
    | ({ status: ListStatus.Ready } & LoadedList)
    | ({ status: ListStatus.LoadingMore } & LoadedList)
    // Failed carries nothing: a retry starts the selection again from its first page.
    | { status: ListStatus.Failed };

// The filters a visitor can set. Paging is the provider's own business, not a filter.
export type CatalogFilters = Omit<BreachFilters, 'page' | 'limit'>;

export const NO_FILTERS: CatalogFilters = {};

export const FIRST_PAGE = 1;

// What the provider's effects answer. `isEnabled` flips once, when the first consumer mounts;
// `attempt` advances on every retry so the same request runs again; `filters` is what the list
// is asked for and `page` how far into it.
export type CatalogRequest = {
    isEnabled: boolean;
    attempt: number;
    filters: CatalogFilters;
    page: number;
};

export const IDLE_REQUEST: CatalogRequest = { isEnabled: false, attempt: 0, filters: NO_FILTERS, page: FIRST_PAGE };

export const isFirstPage = (request: CatalogRequest): boolean => request.page === FIRST_PAGE;

export const isSummaryReady = (state: SummaryState): state is Extract<SummaryState, { status: SummaryStatus.Ready }> =>
    state.status === SummaryStatus.Ready;

export const hasSummaryFailed = (state: SummaryState): boolean => state.status === SummaryStatus.Failed;

export const isListReady = (state: ListState): state is Extract<ListState, { status: ListStatus.Ready }> =>
    state.status === ListStatus.Ready;

export const isLoadingMore = (state: ListState): state is Extract<ListState, { status: ListStatus.LoadingMore }> =>
    state.status === ListStatus.LoadingMore;

// The states with rows on screen — ready, or ready with the next page on its way.
export const hasItems = (state: ListState): state is Extract<ListState, LoadedList> =>
    isListReady(state) || isLoadingMore(state);

export const isListLoading = (state: ListState): boolean => state.status === ListStatus.Loading;

export const hasListFailed = (state: ListState): boolean => state.status === ListStatus.Failed;

export const hasMorePages = (state: LoadedList): boolean => state.items.length < state.total;

export const isEmpty = (state: LoadedList): boolean => state.items.length === 0;

// The first page replaces whatever was there; a later page joins what is already on screen.
export const receivePage = ({
    current,
    page,
    request,
}: {
    current: ListState;
    page: LoadedList;
    request: CatalogRequest;
}): ListState => {
    if (isFirstPage(request) || !hasItems(current)) return { status: ListStatus.Ready, ...page };

    return { status: ListStatus.Ready, items: [...current.items, ...page.items], total: page.total, page: page.page };
};

// What the list shows while a page is on its way: skeletons for a first page, the rows so far
// for a later one.
export const awaitPage = ({ current, request }: { current: ListState; request: CatalogRequest }): ListState => {
    if (isFirstPage(request) || !hasItems(current)) return { status: ListStatus.Loading };

    return { ...current, status: ListStatus.LoadingMore };
};

// The scan moment ends only when both halves of the result screen can render.
export const isCatalogReady = ({ summary, list }: { summary: SummaryState; list: ListState }): boolean =>
    isSummaryReady(summary) && isListReady(list);

// Either half failing is the whole screen failing: a result page with tiles and no rows, or
// rows and no tiles, would be a half-answer presented as a whole one.
export const hasCatalogFailed = ({ summary, list }: { summary: SummaryState; list: ListState }): boolean =>
    hasSummaryFailed(summary) || hasListFailed(list);

export const enableRequest = (request: CatalogRequest): CatalogRequest =>
    request.isEnabled ? request : { ...request, isEnabled: true };

// A retry starts the selection again from its first page.
export const retryRequest = (request: CatalogRequest): CatalogRequest => ({
    ...request,
    isEnabled: true,
    attempt: request.attempt + 1,
    page: FIRST_PAGE,
});

// A changed filter replaces the whole selection — the caller sends what should be in force, not a
// delta, so a control that clears a value simply leaves it out — and starts it from page one.
export const withFilters = (request: CatalogRequest, filters: CatalogFilters): CatalogRequest => ({
    ...request,
    filters,
    page: FIRST_PAGE,
});

export const nextPage = (request: CatalogRequest): CatalogRequest => ({ ...request, page: request.page + 1 });

// What the list endpoint is asked for. The first page is the server's default and sends no
// `page`, so the URL and the history stay clean.
export const toListQuery = (request: CatalogRequest): BreachFilters => ({
    ...request.filters,
    page: isFirstPage(request) ? undefined : request.page,
});
