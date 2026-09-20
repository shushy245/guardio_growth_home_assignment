// The design's ErrorState: a sunken panel, a square danger mark, the failure in the visitor's
// words and one way forward. Deliberately unlike EmptyFilterState (dashed border, round mark):
// "nothing matched" and "something broke" must never read alike.
import type { ReactElement } from 'react';

import { Column } from '~/ui/box';
import { ErrorStateKind, ErrorStateTestIds } from '~/components/ErrorState.utils';

import styles from '~/components/ErrorState.module.scss';

// `actionLabel`/`onAction`, not `retry*`: two of the four call sites offer something else —
// the not-found page sends the visitor to the scan and the boundary reloads the document —
// and a prop named for one caller's verb reads as a lie at the others.
export const ErrorState = ({
    title,
    description,
    actionLabel,
    kind,
    onAction,
}: {
    title: string;
    description: string;
    actionLabel: string;
    kind: ErrorStateKind;
    onAction: () => void;
}): ReactElement => (
    <Column className={styles.panel} data-testid={ErrorStateTestIds.Root}>
        <span className={styles.mark} aria-hidden="true" />
        {titleElementMap[kind](title)}
        <p className={styles.description}>{description}</p>
        <button className={styles.retry} type="button" data-testid={ErrorStateTestIds.Retry} onClick={onAction}>
            {actionLabel}
        </button>
    </Column>
);

// A table rather than a branch, so a third kind has to decide how it is announced instead of
// silently inheriting one. The panel's title is announced — a failure that changes the screen
// silently is one the visitor may never notice — and a page's title is its heading, which a
// screen reader reaches through the document outline without an alert.
const titleElementMap: Record<ErrorStateKind, (title: string) => ReactElement> = {
    [ErrorStateKind.Panel]: (title) => (
        <p className={styles.title} role="alert">
            {title}
        </p>
    ),
    [ErrorStateKind.Page]: (title) => <h1 className={styles.title}>{title}</h1>,
};
