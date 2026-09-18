// The design's BreachRow: scannable on a phone — title, one meta line, the data classes as badges
// with Passwords singled out, the verified mark — and expandable to the description, which has
// no other home on the screen (F21). The initial stands in for a logo, as the design draws it.
import { type ReactElement, useState } from 'react';

import { Column, Row } from '~/ui/box';
import { joinClassNames } from '~/ui/box.utils';
import { type BreachModel, breachInitial, isPasswordsDataClass } from '~/models/breach';
import {
    badgeTestId,
    BreachRowTestIds,
    formatMetaLine,
    HIDE_DETAILS_LABEL,
    SHOW_DETAILS_LABEL,
    VERIFIED_LABEL,
} from '~/components/BreachRow.utils';

import styles from '~/components/BreachRow.module.scss';

export const BreachRow = ({ breach }: { breach: BreachModel }): ReactElement => {
    const [isExpanded, setIsExpanded] = useState(false);

    const handleToggle = (): void => {
        setIsExpanded((current) => !current);
    };

    return (
        <li className={styles.row}>
            <Row className={styles.main}>
                <span className={styles.initial} aria-hidden="true">
                    {breachInitial(breach)}
                </span>
                <Column className={styles.body}>
                    <Row className={styles.titleLine}>
                        <span className={styles.title} data-testid={BreachRowTestIds.Title}>
                            {breach.title}
                        </span>
                        {breach.isVerified ? <VerifiedMark /> : undefined}
                    </Row>
                    <span className={styles.meta} data-testid={BreachRowTestIds.Meta}>
                        {formatMetaLine(breach)}
                    </span>
                    <Row className={styles.badges}>
                        {breach.dataClasses.map((dataClass) => (
                            <DataClassBadge key={dataClass} dataClass={dataClass} />
                        ))}
                    </Row>
                    {isExpanded ? (
                        <p className={styles.description} data-testid={BreachRowTestIds.Description}>
                            {breach.description}
                        </p>
                    ) : undefined}
                </Column>
                <button
                    className={styles.toggle}
                    type="button"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? HIDE_DETAILS_LABEL : SHOW_DETAILS_LABEL}
                    data-testid={BreachRowTestIds.Toggle}
                    onClick={handleToggle}
                >
                    <span
                        className={joinClassNames(styles.chevron, isExpanded ? styles.chevronUp : undefined)}
                        aria-hidden="true"
                    />
                </button>
            </Row>
        </li>
    );
};

const VerifiedMark = (): ReactElement => (
    <span className={styles.verified} data-testid={BreachRowTestIds.Verified}>
        <span className={styles.verifiedMark} aria-hidden="true" />
        {VERIFIED_LABEL}
    </span>
);

const DataClassBadge = ({ dataClass }: { dataClass: string }): ReactElement => (
    <span
        className={joinClassNames(styles.badge, isPasswordsDataClass(dataClass) ? styles.badgeDanger : undefined)}
        data-testid={badgeTestId(dataClass)}
    >
        {dataClass}
    </span>
);
