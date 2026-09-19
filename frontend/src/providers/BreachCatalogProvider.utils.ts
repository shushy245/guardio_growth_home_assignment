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

    return {
        status: ListStatus.Ready,
        items: withoutRepeats([...current.items, ...page.items]),
        total: page.total,
        page: page.page,
    };
};

// A record can arrive on two pages: the catalog refreshes behind the visitor (S2b), and a row
// inserted above the page boundary pushes one record down onto the next page. The list is keyed
// by name, so the repeat was a duplicate React key and a dropped row (BF75). The first copy
// wins — it is the one already on screen.
const withoutRepeats = (items: BreachModel[]): BreachModel[] => {
    const seen = new Set<string>();

    return items.filter((item) => {
        if (seen.has(item.name)) return false;
        seen.add(item.name);

        return true;
    });
};

// What the list shows when a page fails: the error state for a first page — there is nothing
// else to show — and the rows already on screen for a later one, with Load more offered again.
// "Page two failed" must not cost the visitor page one.
export const failPage = ({ current, request }: { current: ListState; request: CatalogRequest }): ListState => {
    if (isFirstPage(request) || !hasItems(current)) return { status: ListStatus.Failed };

    return { ...current, status: ListStatus.Ready };
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

// One reader per filter, and the `Record` is what forces the list to be complete: a filter
// added to the model and forgotten here used to type-check — `readonly (keyof CatalogFilters)[]`
// accepts any subset — and `areSameFilters` then swallowed every change to it, so the chip did
// nothing and nothing failed (BF74).
const filterReaders: Record<keyof CatalogFilters, (filters: CatalogFilters) => unknown> = {
    sort: (filters) => filters.sort,
    order: (filters) => filters.order,
    q: (filters) => filters.q,
    dataClass: (filters) => filters.dataClass,
    verifiedOnly: (filters) => filters.verifiedOnly,
};

export const areSameFilters = (left: CatalogFilters, right: CatalogFilters): boolean =>
    Object.values(filterReaders).every((read) => read(left) === read(right));

// A changed filter replaces the whole selection — the caller sends what should be in force, not a
// delta, so a control that clears a value simply leaves it out — and starts it from page one. A
// selection identical to the one in force is not a change: the request stays the same object, so
// the effect keyed on it does not run and the record is not asked the same question twice.
export const withFilters = (request: CatalogRequest, filters: CatalogFilters): CatalogRequest => {
    if (areSameFilters(request.filters, filters)) return request;

    return { ...request, filters, page: FIRST_PAGE };
};

export const nextPage = (request: CatalogRequest): CatalogRequest => ({ ...request, page: request.page + 1 });

// What the list endpoint is asked for. The first page is the server's default and sends no
// `page`, so the URL and the history stay clean.
export const toListQuery = (request: CatalogRequest): BreachFilters => ({
    ...request.filters,
    page: isFirstPage(request) ? undefined : request.page,
});
