// What an unmatched URL renders. Without it `<Routes>` matches nothing and paints an empty
// document: no heading, no failure, nothing to click, and no way for a visitor to tell a typo
// from an outage (BF69). Outside the funnel's layout route on purpose — a visitor who never
// reached a real screen is not in the experiment and records no step.
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { MainColumn } from '~/ui/box';
import { ErrorState } from '~/components/ErrorState';
import { ErrorStateKind } from '~/components/ErrorState.utils';
import {
    NOT_FOUND_ACTION_LABEL,
    NOT_FOUND_DESCRIPTION,
    NOT_FOUND_TITLE,
    NotFoundTestIds,
} from '~/pages/NotFound.utils';

import styles from '~/pages/NotFound.module.scss';

export const NotFound = (): ReactElement => {
    const navigate = useNavigate();

    const handleGoToScan = (): void => {
        void navigate('/');
    };

    return (
        <MainColumn className={styles.page} data-testid={NotFoundTestIds.Page}>
            <ErrorState
                title={NOT_FOUND_TITLE}
                description={NOT_FOUND_DESCRIPTION}
                retryLabel={NOT_FOUND_ACTION_LABEL}
                kind={ErrorStateKind.Page}
                onRetry={handleGoToScan}
            />
        </MainColumn>
    );
};
