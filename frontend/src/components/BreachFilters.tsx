// The design's filter bar — SearchField, FilterChip row, ToggleField, SegmentedControl and
// ResultsLine — one thumb away from the list. Every control writes the filters in force to the
// catalog and reads its own state back from them, so the bar can never disagree with the query
// that was sent. Nothing here narrows or orders anything: the server does, per request.
import type { ReactElement } from 'react';

import { Column, Row } from '~/ui/box';
import { joinClassNames } from '~/ui/box.utils';
import type { DataClassCountModel } from '~/models/breach';
import { useBreachCatalog } from '~/providers/BreachCatalogProvider';
import { type CatalogFilters, isSummaryReady } from '~/providers/BreachCatalogProvider.utils';
import {
    activeSortOption,
    dataClassChipTestId,
    isDataClassSelected,
    SortOption,
    sortLabelMap,
    sortOptionMap,
    sortSegmentTestId,
} from '~/components/BreachFilters.utils';

import styles from '~/components/BreachFilters.module.scss';

export const BreachFilters = (): ReactElement => {
    const { summary, filters, setFilters } = useBreachCatalog();

    const handleSort = (option: SortOption): void => {
        setFilters({ ...filters, ...sortOptionMap[option] });
    };

    const handleDataClass = (dataClass: string): void => {
        setFilters({ ...filters, dataClass: isDataClassSelected(filters, dataClass) ? undefined : dataClass });
    };

    return (
        <Column className={styles.bar}>
            {isSummaryReady(summary) ? (
                <DataClassChips classes={summary.summary.topDataClasses} filters={filters} onToggle={handleDataClass} />
            ) : undefined}
            <SortControl filters={filters} onSort={handleSort} />
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
