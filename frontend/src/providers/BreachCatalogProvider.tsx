// The breach catalog as the funnel sees it: the summary tiles and the list, loaded once and read
// by every funnel page. It sits on the funnel layout route so the scan moment can load the record
// and the result screen can show it without a second round trip. Pages read it through
// `useBreachCatalog` (the hook is the port, the provider the adapter); mounting a consumer is what
// asks for the data, so a direct visit to /result loads it as surely as the scan does.
import {
    createContext,
    type ReactElement,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

import { logger } from '~/logging/logger';
import { describeError, isCancelled } from '~/api/http-client';
import { fetchBreaches, fetchBreachSummary } from '~/api/breaches';
import {
    awaitPage,
    type CatalogFilters,
    type CatalogRequest,
    enableRequest,
    failPage,
    IDLE_REQUEST,
    type ListState,
    ListStatus,
    nextPage,
    receivePage,
    retryRequest,
    type SummaryState,
    SummaryStatus,
    toListQuery,
    withFilters,
} from '~/providers/BreachCatalogProvider.utils';

type BreachCatalogContextValue = {
    summary: SummaryState;
    list: ListState;
    filters: CatalogFilters;
    load: () => void;
    retry: () => void;
    setFilters: (filters: CatalogFilters) => void;
    loadMore: () => void;
};

const BreachCatalogContext = createContext<BreachCatalogContextValue | undefined>(undefined);

export const BreachCatalogProvider = ({ children }: { children: ReactNode }): ReactElement => {
    const [request, setRequest] = useState<CatalogRequest>(IDLE_REQUEST);
    const [summary, setSummary] = useState<SummaryState>({ status: SummaryStatus.Idle });
    const [list, setList] = useState<ListState>({ status: ListStatus.Idle });

    // The summary answers the request's enabled/attempt pair and nothing else: a filter change
    // must not refetch the tiles. The effect owns its controller and its cleanup aborts the fetch;
    // axios turns a request whose signal was aborted into a rejected CanceledError even when the
    // answer had already arrived, so the `isCancelled` return in the catch is the whole of the
    // stale-answer protection — there is no reachable "resolved after abort" path to guard.
    useEffect(() => {
        if (!request.isEnabled) return;
        const controller = new AbortController();
        const { signal } = controller;
        setSummary({ status: SummaryStatus.Loading });

        fetchBreachSummary({ signal })
            .then((loaded) => {
                setSummary({ status: SummaryStatus.Ready, summary: loaded });
            })
            .catch((error: unknown) => {
                if (isCancelled(error)) return;
                logger.error('BreachCatalogProvider: the summary could not be loaded', {
                    attempt: request.attempt,
                    detail: describeError(error),
                });
                setSummary({ status: SummaryStatus.Failed });
            });

        return (): void => {
            controller.abort();
        };
    }, [request.isEnabled, request.attempt]);

    // The list answers the filters and the page too. Its cleanup aborts the page in flight, and the
    // same CanceledError path is what stops a response to an older filter landing over a newer one.
    useEffect(() => {
        if (!request.isEnabled) return;
        const controller = new AbortController();
        const { signal } = controller;
        setList((current) => awaitPage({ current, request }));

        fetchBreaches({ filters: toListQuery(request), signal })
            .then((page) => {
                setList((current) => receivePage({ current, page, request }));
            })
            .catch((error: unknown) => {
                if (isCancelled(error)) return;
                logger.error('BreachCatalogProvider: the breach list could not be loaded', {
                    attempt: request.attempt,
                    filters: request.filters,
                    page: request.page,
                    detail: describeError(error),
                });
                setList((current) => failPage({ current, request }));
            });

        return (): void => {
            controller.abort();
        };
    }, [request]);

    const load = useCallback((): void => {
        setRequest(enableRequest);
    }, []);

    const retry = useCallback((): void => {
        setRequest(retryRequest);
    }, []);

    const setFilters = useCallback((filters: CatalogFilters): void => {
        setRequest((current) => withFilters(current, filters));
    }, []);

    const loadMore = useCallback((): void => {
        setRequest(nextPage);
    }, []);

    const value = useMemo<BreachCatalogContextValue>(
        () => ({ summary, list, filters: request.filters, load, retry, setFilters, loadMore }),
        [summary, list, request.filters, load, retry, setFilters, loadMore],
    );

    return <BreachCatalogContext.Provider value={value}>{children}</BreachCatalogContext.Provider>;
};

export type BreachCatalog = Omit<BreachCatalogContextValue, 'load'>;

// Reading the catalog is asking for it: the first consumer to mount starts the load, and every
// later one finds it in flight or done. `load` is idempotent, so the effect is safe under
// StrictMode and under many consumers.
export const useBreachCatalog = (): BreachCatalog => {
    const catalog = useContext(BreachCatalogContext);
    if (catalog === undefined) {
        throw new Error(
            'useBreachCatalog: no BreachCatalogProvider above this component — add it inside the funnel routes',
        );
    }
    const { load, ...readable } = catalog;

    useEffect(() => {
        load();
    }, [load]);

    return readable;
};
