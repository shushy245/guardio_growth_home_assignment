// The design's breach list: rows from the catalog, twenty at a time with Load more, skeleton rows
// while the first page loads, an empty state that is plainly not an error (dashed border, round
// mark) and an error state that is plainly not empty. Every ordering and narrowing happened on
// the server; this renders what came back.
import type { ReactElement } from 'react';

import { Column } from '~/ui/box';
import { BreachRow } from '~/components/BreachRow';
import { ErrorState } from '~/components/ErrorState';
import { ErrorStateKind } from '~/components/ErrorState.utils';
import { useBreachCatalog } from '~/providers/BreachCatalogProvider';
import { CLEAR_FILTERS_LABEL, withoutFilters } from '~/components/BreachFilters.utils';
import {
    hasItems,
    hasListFailed,
    hasMorePages,
    isEmpty,
    isLoadingMore,
    type ListState,
    type LoadedList,
} from '~/providers/BreachCatalogProvider.utils';
import {
    BreachListTestIds,
    EMPTY_FILTER_DESCRIPTION,
    EMPTY_FILTER_TITLE,
    LIST_FAILED_DESCRIPTION,
    LIST_FAILED_TITLE,
    LIST_RETRY_LABEL,
    LOAD_MORE_LABEL,
    LOADING_MORE_LABEL,
    SKELETON_ROW_COUNT,
} from '~/components/BreachList.utils';

import styles from '~/components/BreachList.module.scss';

export const BreachList = (): ReactElement => {
    const { list, filters, retry, setFilters, loadMore } = useBreachCatalog();

    const handleClearFilters = (): void => {
        setFilters(withoutFilters(filters));
    };

    if (hasListFailed(list)) {
        return (
            <ErrorState
                title={LIST_FAILED_TITLE}
                description={LIST_FAILED_DESCRIPTION}
                actionLabel={LIST_RETRY_LABEL}
                kind={ErrorStateKind.Panel}
                onAction={retry}
            />
        );
    }
    if (!hasItems(list)) return <SkeletonRows />;
    if (isEmpty(list)) return <EmptyFilterState onClear={handleClearFilters} />;

    return (
        <Column className={styles.list}>
            <ul className={styles.rows} data-testid={BreachListTestIds.Rows}>
                {list.items.map((breach) => (
                    <BreachRow key={breach.name} breach={breach} />
                ))}
            </ul>
            <LoadMoreButton list={list} onLoadMore={loadMore} />
        </Column>
    );
};

const LoadMoreButton = ({
    list,
    onLoadMore,
}: {
    list: LoadedList & ListState;
    onLoadMore: () => void;
}): ReactElement | undefined => {
    if (!hasMorePages(list)) return undefined;
    const isBusy = isLoadingMore(list);

    return (
        <button
            className={styles.loadMore}
            type="button"
            disabled={isBusy}
            aria-busy={isBusy}
            data-testid={BreachListTestIds.LoadMore}
            onClick={onLoadMore}
        >
            {isBusy ? LOADING_MORE_LABEL : LOAD_MORE_LABEL}
        </button>
    );
};

const SkeletonRows = (): ReactElement => (
    <ul className={styles.rows} data-testid={BreachListTestIds.Skeleton} aria-busy="true">
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
            <li key={index} className={styles.skeletonRow}>
                <span className={styles.skeletonInitial} />
                <Column className={styles.skeletonBody}>
                    <span className={styles.skeletonTitle} />
                    <span className={styles.skeletonMeta} />
                </Column>
            </li>
        ))}
    </ul>
);

const EmptyFilterState = ({ onClear }: { onClear: () => void }): ReactElement => (
    <Column className={styles.empty} data-testid={BreachListTestIds.EmptyFilter}>
        <span className={styles.emptyMark} aria-hidden="true" />
        <p className={styles.emptyTitle} role="status">
            {EMPTY_FILTER_TITLE}
        </p>
        <p className={styles.emptyDescription}>{EMPTY_FILTER_DESCRIPTION}</p>
        <button className={styles.clear} type="button" data-testid={BreachListTestIds.ClearFilters} onClick={onClear}>
            {CLEAR_FILTERS_LABEL}
        </button>
    </Column>
);
