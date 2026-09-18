// The design's filter bar — SearchField, FilterChip row, ToggleField, SegmentedControl and
// ResultsLine — one thumb away from the list. Every control writes the filters in force to the
// catalog and reads its own state back from them, so the bar can never disagree with the query
// that was sent. Nothing here narrows or orders anything: the server does, per request.
import type { ChangeEvent, ReactElement } from 'react';

import { Column, Row } from '~/ui/box';
import { joinClassNames } from '~/ui/box.utils';
import { SearchField } from '~/components/SearchField';
import type { DataClassCountModel } from '~/models/breach';
import { useBreachCatalog } from '~/providers/BreachCatalogProvider';
import { type CatalogFilters, isListReady, isSummaryReady } from '~/providers/BreachCatalogProvider.utils';
import {
    activeSortOption,
    BreachFiltersTestIds,
    CLEAR_FILTERS_LABEL,
    dataClassChipTestId,
    formatResultsLine,
    hasActiveFilters,
    isDataClassSelected,
    SortOption,
    sortLabelMap,
    sortOptionMap,
    sortSegmentTestId,
    VERIFIED_ONLY_LABEL,
    withoutFilters,
} from '~/components/BreachFilters.utils';

import styles from '~/components/BreachFilters.module.scss';

export const BreachFilters = (): ReactElement => {
    const { summary, list, filters, setFilters } = useBreachCatalog();

    const handleSort = (option: SortOption): void => {
        setFilters({ ...filters, ...sortOptionMap[option] });
    };

    const handleDataClass = (dataClass: string): void => {
        setFilters({ ...filters, dataClass: isDataClassSelected(filters, dataClass) ? undefined : dataClass });
    };

    const handleVerifiedOnly = (event: ChangeEvent<HTMLInputElement>): void => {
        setFilters({ ...filters, verifiedOnly: event.target.checked ? true : undefined });
    };

    const handleClearFilters = (): void => {
        setFilters(withoutFilters(filters));
    };

    const handleSearch = (q: string | undefined): void => {
        setFilters({ ...filters, q });
    };

    return (
        <Column className={styles.bar}>
            <SearchField query={filters.q} onSearch={handleSearch} />
            {isSummaryReady(summary) ? (
                <DataClassChips classes={summary.summary.topDataClasses} filters={filters} onToggle={handleDataClass} />
            ) : undefined}
            <Row className={styles.controls}>
                <label className={styles.toggle}>
                    <input
                        className={styles.switch}
                        type="checkbox"
                        role="switch"
                        checked={filters.verifiedOnly === true}
                        data-testid={BreachFiltersTestIds.VerifiedOnly}
                        onChange={handleVerifiedOnly}
                    />
                    <span>{VERIFIED_ONLY_LABEL}</span>
                </label>
                <SortControl filters={filters} onSort={handleSort} />
            </Row>
            {isListReady(list) ? (
                <Row className={styles.resultsLine}>
                    <span className={styles.results} data-testid={BreachFiltersTestIds.ResultsLine} role="status">
                        {formatResultsLine({ shown: list.items.length, total: list.total })}
                    </span>
                    {hasActiveFilters(filters) ? (
                        <button
                            className={styles.clear}
                            type="button"
                            data-testid={BreachFiltersTestIds.ClearFilters}
                            onClick={handleClearFilters}
                        >
                            {CLEAR_FILTERS_LABEL}
                        </button>
                    ) : undefined}
                </Row>
            ) : undefined}
        </Column>
    );
};

const DataClassChips = ({
    classes,
    filters,
    onToggle,
}: {
    classes: DataClassCountModel[];
    filters: CatalogFilters;
    onToggle: (dataClass: string) => void;
}): ReactElement => (
    <Row className={styles.chips}>
        {classes.map(({ dataClass }) => (
            <FilterChip
                key={dataClass}
                dataClass={dataClass}
                isSelected={isDataClassSelected(filters, dataClass)}
                onToggle={onToggle}
            />
        ))}
    </Row>
);

const FilterChip = ({
    dataClass,
    isSelected,
    onToggle,
}: {
    dataClass: string;
    isSelected: boolean;
    onToggle: (dataClass: string) => void;
}): ReactElement => {
    const handleClick = (): void => {
        onToggle(dataClass);
    };

    return (
        <button
            className={joinClassNames(styles.chip, isSelected ? styles.chipSelected : undefined)}
            type="button"
            aria-pressed={isSelected}
            data-testid={dataClassChipTestId(dataClass)}
            onClick={handleClick}
        >
            {dataClass}
        </button>
    );
};

const SortControl = ({
    filters,
    onSort,
}: {
    filters: CatalogFilters;
    onSort: (option: SortOption) => void;
}): ReactElement => {
    const active = activeSortOption(filters);

    return (
        <fieldset className={styles.segments}>
            <legend className={styles.legend}>{`Sort breaches`}</legend>
            {Object.values(SortOption).map((option) => (
                <SortSegment key={option} option={option} isSelected={option === active} onSort={onSort} />
            ))}
        </fieldset>
    );
};

const SortSegment = ({
    option,
    isSelected,
    onSort,
}: {
    option: SortOption;
    isSelected: boolean;
    onSort: (option: SortOption) => void;
}): ReactElement => {
    const handleClick = (): void => {
        onSort(option);
    };

    return (
        <button
            className={joinClassNames(styles.segment, isSelected ? styles.segmentSelected : undefined)}
            type="button"
            aria-pressed={isSelected}
            data-testid={sortSegmentTestId(option)}
            onClick={handleClick}
        >
            {sortLabelMap[option]}
        </button>
    );
};
