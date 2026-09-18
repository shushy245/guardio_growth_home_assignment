// The design's ErrorState: a sunken panel, a square danger mark, the failure in the visitor's
// words and one way forward. Deliberately unlike EmptyFilterState (dashed border, round mark):
// "nothing matched" and "something broke" must never read alike.
import type { ReactElement } from 'react';

import { Column } from '~/ui/box';
import { ErrorStateTestIds } from '~/components/ErrorState.utils';

import styles from '~/components/ErrorState.module.scss';

export const ErrorState = ({
    title,
    description,
    retryLabel,
    onRetry,
}: {
    title: string;
    description: string;
    retryLabel: string;
    onRetry: () => void;
}): ReactElement => (
    <Column className={styles.panel} data-testid={ErrorStateTestIds.Root}>
        <span className={styles.mark} aria-hidden="true" />
        {/* Announced: a failure that changes the screen silently is one the visitor may never notice. */}
        <p className={styles.title} role="alert">
            {title}
        </p>
        <p className={styles.description}>{description}</p>
        <button className={styles.retry} type="button" data-testid={ErrorStateTestIds.Retry} onClick={onRetry}>
            {retryLabel}
        </button>
    </Column>
);
