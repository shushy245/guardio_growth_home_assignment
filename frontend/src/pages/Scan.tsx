// The scan moment, the design's S-2: a full-screen check that holds for at least two seconds
// while the breach record loads, then moves to the result. Identical at every width — a transient
// centred state has nothing to reflow. A record that cannot be reached is the error state with a
// retry, never a result screen with holes in it.
import { useNavigate } from 'react-router';
import { type ReactElement, useCallback, useState } from 'react';

import { Column, MainColumn } from '~/ui/box';
import { Wordmark } from '~/components/Wordmark';
import { ErrorState } from '~/components/ErrorState';
import { generateUniqueId } from '~/shared/ids.utils';
import { useScanMoment } from '~/hooks/useScanMoment';
import { FunnelEventName } from '~/models/funnelEvent';
import { useAnalytics } from '~/providers/AnalyticsProvider';
import { ErrorStateKind } from '~/components/ErrorState.utils';
import { useBreachCatalog } from '~/providers/BreachCatalogProvider';
import { hasCatalogFailed, isCatalogReady } from '~/providers/BreachCatalogProvider.utils';
import {
    RESULT_ROUTE,
    SCAN_FAILED_DESCRIPTION,
    SCAN_FAILED_TITLE,
    SCAN_RETRY_LABEL,
    ScanTestIds,
} from '~/pages/Scan.utils';

import styles from '~/pages/Scan.module.scss';

export const Scan = (): ReactElement => {
    const { summary, list, retry } = useBreachCatalog();
    const { record } = useAnalytics();
    const navigate = useNavigate();
    // One id per mount, so the completion is recorded once however many times the effect that
    // reports it is run — StrictMode runs it twice, and the provider records the id once.
    const [completedId] = useState(() => generateUniqueId('evt'));

    const handleComplete = useCallback((): void => {
        record({ id: completedId, name: FunnelEventName.ScanCompleted });
        void navigate(RESULT_ROUTE);
    }, [record, completedId, navigate]);

    useScanMoment({ isCatalogReady: isCatalogReady({ summary, list }), onComplete: handleComplete });

    return (
        <MainColumn className={styles.page} data-testid={ScanTestIds.Page}>
            <Wordmark />
            {hasCatalogFailed({ summary, list }) ? (
                <ErrorState
                    title={SCAN_FAILED_TITLE}
                    description={SCAN_FAILED_DESCRIPTION}
                    retryLabel={SCAN_RETRY_LABEL}
                    kind={ErrorStateKind.Panel}
                    onRetry={retry}
                />
            ) : (
                <Scanning />
            )}
        </MainColumn>
    );
};

const Scanning = (): ReactElement => (
    <Column className={styles.scanning} data-testid={ScanTestIds.Scanning}>
        <span className={styles.spinner} aria-hidden="true" />
        {/* Announced once: the check is the only thing on the screen, and it is in progress. */}
        <p className={styles.lead} role="status">{`Checking the public record of known breaches…`}</p>
        <span className={styles.track} aria-hidden="true">
            <span className={styles.fill} />
        </span>
    </Column>
);
