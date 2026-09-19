// The design's PasswordField: a TextField that also says what the leak check found. It owns
// nothing — the page holds the password and runs the check — so the same field can render the
// inline validation the design shows on submit. What the check says is a lookup by status, never
// a chain of branches (Open/Closed).
//
// The notices are siblings of the input, not children of its label, and reach it through
// `aria-describedby`. Inside the label they became part of the field's accessible *name*: a
// screen reader announced "Password This password appeared in 3,120,000 leaks…" as the field's
// identity, and renamed it under the visitor as they typed (BF62).
import { type ChangeEvent, type ReactElement, useId } from 'react';

import { Column } from '~/ui/box';
import {
    CHECKING_MESSAGE,
    describedBy,
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
    // The input's own id, so its label points at it from outside; the notice's and the error's,
    // so the field describes itself by whichever of them is on screen.
    const inputId = useId();
    const noticeId = useId();
    const errorId = useId();
    const notice = checkNoticeMap[check.status]({ check, id: noticeId });

    const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
        onChange(event.target.value);
    };

    return (
        <Column className={styles.field}>
            <label className={styles.label} htmlFor={inputId}>
                {PASSWORD_LABEL}
            </label>
            <input
                id={inputId}
                className={validationError === undefined ? styles.input : styles.inputInvalid}
                type="password"
                name="password"
                autoComplete="new-password"
                aria-invalid={validationError !== undefined}
                aria-describedby={describedBy(
                    notice === undefined ? undefined : noticeId,
                    validationError === undefined ? undefined : errorId,
                )}
                value={value}
                data-testid={PasswordFieldTestIds.Input}
                onChange={handleChange}
            />
            {notice}
            {validationError === undefined ? undefined : (
                <span id={errorId} className={styles.error} role="alert" data-testid={PasswordFieldTestIds.Error}>
                    {validationError}
                </span>
            )}
        </Column>
    );
};

const CheckingNotice = ({ id }: { id: string }): ReactElement => (
    // Announced: the field is doing something the visitor cannot see.
    <span id={id} className={styles.checking} role="status" data-testid={PasswordFieldTestIds.Checking}>
        <span className={styles.spinner} aria-hidden="true" />
        {CHECKING_MESSAGE}
    </span>
);

const LeakedNotice = ({ id, count }: { id: string; count: number }): ReactElement => (
    <span id={id} className={styles.leaked} role="status" data-testid={PasswordFieldTestIds.Leaked}>
        {leakedMessage(count)}
    </span>
);

const UncheckedNotice = ({ id }: { id: string }): ReactElement => (
    <span id={id} className={styles.unchecked} role="status" data-testid={PasswordFieldTestIds.Unchecked}>
        {UNCHECKED_MESSAGE}
    </span>
);

type NoticeInput = { check: PasswordCheck; id: string };

const nothing = (): undefined => undefined;

const checkNoticeMap: Record<PasswordCheckStatus, (input: NoticeInput) => ReactElement | undefined> = {
    [PasswordCheckStatus.Idle]: nothing,
    [PasswordCheckStatus.Clean]: nothing,
    [PasswordCheckStatus.Checking]: ({ id }) => <CheckingNotice id={id} />,
    // The guard narrows to reach the count; the map already chose this entry by status.
    [PasswordCheckStatus.Leaked]: ({ check, id }) =>
        isLeaked(check) ? <LeakedNotice id={id} count={check.count} /> : undefined,
    [PasswordCheckStatus.Unchecked]: ({ id }) => <UncheckedNotice id={id} />,
};
