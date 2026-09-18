// The result screen — the design's S-3 and the heart of the exercise. One layout, one component
// tree; the variant changes the words in the header and the tone class on the root, and nothing
// else. The CTA is one node: a sticky bar at 390 that the stylesheet moves inline into the header
// at 768+ (deviation 2), so no width is ever read in here.
import type { ReactElement } from 'react';

import { Column, MainColumn } from '~/ui/box';
import { joinClassNames } from '~/ui/box.utils';
import { BreachList } from '~/components/BreachList';
import { useVisitor } from '~/providers/VisitorProvider';
import { BreachSummary } from '~/components/BreachSummary';
import { BreachFilters } from '~/components/BreachFilters';
import { resolveResultCopy, ResultTestIds, toneClassMap } from '~/pages/Result.utils';

import styles from '~/pages/Result.module.scss';

export const Result = (): ReactElement => {
    const copy = resolveResultCopy(useVisitor());

    return (
        <MainColumn className={joinClassNames(styles.page, toneClassMap[copy.tone])} data-testid={ResultTestIds.Page}>
            <Column className={styles.header}>
                <h1 className={styles.headline} data-testid={ResultTestIds.Headline}>
                    {copy.headline}
                </h1>
                <p className={styles.subheadline} data-testid={ResultTestIds.Subheadline}>
                    {copy.subheadline}
                </p>
            </Column>
            <Column className={styles.body}>
                <BreachSummary tone={copy.tone} />
                <BreachFilters />
                <BreachList />
            </Column>
            <Column className={styles.stickyBar} data-testid={ResultTestIds.StickyBar}>
                <button className={styles.cta} type="button" data-testid={ResultTestIds.Cta}>
                    {copy.ctaLabel}
                </button>
            </Column>
        </MainColumn>
    );
};
