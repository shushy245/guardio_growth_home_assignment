// The funnel's first screen: one promise, one button, three reasons to trust it. The layout is
// the design's S-1 — a left-aligned column at 390 that centres and widens at 768+, by CSS only.
import { ReactElement } from 'react';

import { Column, MainColumn } from '~/ui/box';
import { useTrackOnce } from '~/hooks/useTrackOnce';
import { FunnelEventName } from '~/models/funnelEvent';
import { LandingTestIds, TRUST_POINTS } from '~/pages/Landing.utils';

import styles from '~/pages/Landing.module.scss';

export const Landing = (): ReactElement => {
    useTrackOnce(FunnelEventName.LandingView);

    return (
        <MainColumn className={styles.page} data-testid={LandingTestIds.Page}>
            <span className={styles.wordmark}>{`Guardio`}</span>
            <Column className={styles.hero}>
                <h1 className={styles.headline}>{`Find out if you've been breached`}</h1>
                <p className={styles.lead}>
                    {`Guardio checks your accounts against the public record of known data breaches. No email address needed.`}
                </p>
                <button className={styles.scan} type="button" data-testid={LandingTestIds.Scan}>
                    {`Scan known breaches`}
                </button>
            </Column>
            <TrustPoints />
        </MainColumn>
    );
};

const TrustPoints = (): ReactElement => (
    <ul className={styles.trustPoints}>
        {TRUST_POINTS.map((point) => (
            <li key={point} className={styles.trustPoint}>
                <span className={styles.check} aria-hidden="true">{`✓`}</span>
                <span>{point}</span>
            </li>
        ))}
    </ul>
);
