// The design's PasswordField: a TextField that also says what the leak check found. It owns
// nothing — the page holds the password and runs the check — so the same field can render the
// inline validation the design shows on submit. What the check says is a lookup by status, never
// a chain of branches (Open/Closed).
import type { ChangeEvent, ReactElement } from 'react';

import {
    CHECKING_MESSAGE,
    isLeaked,
    leakedMessage,
    PASSWORD_LABEL,
    type PasswordCheck,
    PasswordCheckStatus,
    PasswordFieldTestIds,
    UNCHECKED_MESSAGE,
} from '~/components/PasswordField.utils';

import styles from '~/components/PasswordField.module.scss';

export const PasswordField = ({
    value,
    onChange,
    check,
    validationError,
}: {
    value: string;
    onChange: (password: string) => void;
    check: PasswordCheck;
    validationError: string | undefined;
}): ReactElement => {
    const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
        onChange(event.target.value);
    };

    return (
        <label className={styles.field}>
            <span className={styles.label}>{PASSWORD_LABEL}</span>
            <input
                className={validationError === undefined ? styles.input : styles.inputInvalid}
                type="password"
                autoComplete="new-password"
                aria-invalid={validationError !== undefined}
                value={value}
                data-testid={PasswordFieldTestIds.Input}
                onChange={handleChange}
            />
            {checkNoticeMap[check.status](check)}
            {validationError === undefined ? undefined : (
                <span className={styles.error} role="alert" data-testid={PasswordFieldTestIds.Error}>
                    {validationError}
                </span>
            )}
        </label>
    );
};

const CheckingNotice = (): ReactElement => (
    // Announced: the field is doing something the visitor cannot see.
    <span className={styles.checking} role="status" data-testid={PasswordFieldTestIds.Checking}>
        <span className={styles.spinner} aria-hidden="true" />
        {CHECKING_MESSAGE}
    </span>
);

const LeakedNotice = ({ count }: { count: number }): ReactElement => (
    <span className={styles.leaked} role="status" data-testid={PasswordFieldTestIds.Leaked}>
        {leakedMessage(count)}
    </span>
);

const UncheckedNotice = (): ReactElement => (
    <span className={styles.unchecked} role="status" data-testid={PasswordFieldTestIds.Unchecked}>
        {UNCHECKED_MESSAGE}
    </span>
);

const nothing = (): undefined => undefined;

const checkNoticeMap: Record<PasswordCheckStatus, (check: PasswordCheck) => ReactElement | undefined> = {
    [PasswordCheckStatus.Idle]: nothing,
    [PasswordCheckStatus.Clean]: nothing,
    [PasswordCheckStatus.Checking]: () => <CheckingNotice />,
    // The guard narrows to reach the count; the map already chose this entry by status.
    [PasswordCheckStatus.Leaked]: (check) => (isLeaked(check) ? <LeakedNotice count={check.count} /> : undefined),
    [PasswordCheckStatus.Unchecked]: () => <UncheckedNotice />,
};
