// The result screen — the design's S-3 and the heart of the exercise. One layout, one component
// tree; the variant changes the words in the header and the tone class on the root, and nothing
// else. The CTA is one node: a sticky bar at 390 that the stylesheet moves inline into the header
// at 768+ (deviation 2), so no width is ever read in here.
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';

import { joinClassNames } from '~/ui/box.utils';
import { Column, MainColumn, Row } from '~/ui/box';
import { BreachList } from '~/components/BreachList';
import { FunnelEventName } from '~/models/funnelEvent';
import { useVisitor } from '~/providers/VisitorProvider';
import { BreachSummary } from '~/components/BreachSummary';
import { BreachFilters } from '~/components/BreachFilters';
import { useAnalytics } from '~/providers/AnalyticsProvider';
import { resolveResultCopy, ResultTestIds, SIGNUP_ROUTE, toneClassMap } from '~/pages/Result.utils';

import styles from '~/pages/Result.module.scss';

export const Result = (): ReactElement => {
    const copy = resolveResultCopy(useVisitor());
    const { track } = useAnalytics();
    const navigate = useNavigate();

    const handleCta = (): void => {
        track(FunnelEventName.CtaClick);
        void navigate(SIGNUP_ROUTE);
    };

    return (
        <MainColumn className={joinClassNames(styles.page, toneClassMap[copy.tone])} data-testid={ResultTestIds.Page}>
            {/* The header holds the CTA's one node. At 390 the bar is fixed to the bottom of the
                viewport; at 768+ the stylesheet sets it back inline beside the headline. */}
            <header className={styles.headerBand}>
                <Row className={styles.header}>
                    <Column className={styles.headerText}>
                        <h1 className={styles.headline} data-testid={ResultTestIds.Headline}>
                            {copy.headline}
                        </h1>
                        <p className={styles.subheadline} data-testid={ResultTestIds.Subheadline}>
                            {copy.subheadline}
                        </p>
                    </Column>
                    <Column className={styles.stickyBar} data-testid={ResultTestIds.StickyBar}>
                        <button
                            className={styles.cta}
                            type="button"
                            data-testid={ResultTestIds.Cta}
                            onClick={handleCta}
                        >
                            {copy.ctaLabel}
                        </button>
                    </Column>
                </Row>
            </header>
            <Column className={styles.body}>
                <BreachSummary tone={copy.tone} />
                <BreachFilters />
                <BreachList />
            </Column>
        </MainColumn>
    );
};
