// The sign-up screen, the design's S-4: a plan, an email, a password, one button. Single column
// at every width; only the whitespace around it grows. The page holds the form's state and runs
// the leak check on the password; the fields render what they are handed.
import { useNavigate } from 'react-router';
import { type ChangeEvent, type FormEvent, type ReactElement, useState } from 'react';

import { logger } from '~/logging/logger';
import { createSignup } from '~/api/signups';
import { Column, MainColumn } from '~/ui/box';
import { Wordmark } from '~/components/Wordmark';
import { describeError } from '~/api/http-client';
import { useTrackOnce } from '~/hooks/useTrackOnce';
import { PlanPicker } from '~/components/PlanPicker';
import { FunnelEventName } from '~/models/funnelEvent';
import { PasswordField } from '~/components/PasswordField';
import { wasPwned } from '~/components/PasswordField.utils';
import { usePasswordLeakCheck } from '~/hooks/usePasswordLeakCheck';
import {
    DEFAULT_PLAN,
    describeSignupFailure,
    EMAIL_LABEL,
    hasValidationErrors,
    IDLE_SUBMISSION,
    isFailed,
    isSubmitting,
    NO_VALIDATION_ERRORS,
    PROTECTED_ROUTE,
    type ProtectedRouteState,
    SIGNUP_HEADLINE,
    SIGNUP_NOTE,
    SignupTestIds,
    type Submission,
    SubmissionStatus,
    SUBMIT_LABEL,
    SUBMITTING_LABEL,
    validateSignupForm,
} from '~/pages/Signup.utils';

import styles from '~/pages/Signup.module.scss';

export const Signup = (): ReactElement => {
    useTrackOnce(FunnelEventName.SignupStarted);
    const navigate = useNavigate();
    const [plan, setPlan] = useState(DEFAULT_PLAN);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [validation, setValidation] = useState(NO_VALIDATION_ERRORS);
    const [submission, setSubmission] = useState<Submission>(IDLE_SUBMISSION);
    const check = usePasswordLeakCheck(password);

    const handleEmailChange = (event: ChangeEvent<HTMLInputElement>): void => {
        setEmail(event.target.value);
        setValidation((current) => ({ ...current, email: undefined }));
    };

    const handlePasswordChange = (next: string): void => {
        setPassword(next);
        setValidation((current) => ({ ...current, password: undefined }));
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        // A second tap while the first request is out is the same request, not a new one.
        if (isSubmitting(submission)) return;
        const errors = validateSignupForm({ email, password });
        setValidation(errors);
        if (hasValidationErrors(errors)) return;

        setSubmission({ status: SubmissionStatus.Submitting });
        // The leak flag belongs to the password being sent: a warning for a password since
        // edited is not carried onto this one.
        createSignup({ email: email.trim(), plan, password, passwordWasPwned: wasPwned({ check, password }) })
            .then(() => {
                const state: ProtectedRouteState = { plan };
                void navigate(PROTECTED_ROUTE, { state });
            })
            .catch((error: unknown) => {
                logger.error('handleSubmit: the sign-up was refused', { plan, detail: describeError(error) });
                setSubmission({ status: SubmissionStatus.Failed, message: describeSignupFailure(error) });
            });
    };

    return (
        <MainColumn className={styles.page} data-testid={SignupTestIds.Page}>
            <Wordmark />
            <form className={styles.form} noValidate onSubmit={handleSubmit}>
                <Column className={styles.intro}>
                    <h1 className={styles.headline}>{SIGNUP_HEADLINE}</h1>
                    <p className={styles.note}>{SIGNUP_NOTE}</p>
                </Column>
                <PlanPicker value={plan} onChange={setPlan} />
                <Column className={styles.fields}>
                    <label className={styles.field}>
                        <span className={styles.label}>{EMAIL_LABEL}</span>
                        <input
                            className={validation.email === undefined ? styles.input : styles.inputInvalid}
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            aria-invalid={validation.email !== undefined}
                            value={email}
                            data-testid={SignupTestIds.Email}
                            onChange={handleEmailChange}
                        />
                        {validation.email === undefined ? undefined : (
                            <span className={styles.error} role="alert" data-testid={SignupTestIds.EmailError}>
                                {validation.email}
                            </span>
                        )}
                    </label>
                    <PasswordField
                        value={password}
                        onChange={handlePasswordChange}
                        check={check}
                        validationError={validation.password}
                    />
                    {isFailed(submission) ? (
                        <p className={styles.serverMessage} role="alert" data-testid={SignupTestIds.ServerMessage}>
                            {submission.message}
                        </p>
                    ) : undefined}
                    <SubmitButton isBusy={isSubmitting(submission)} />
                </Column>
            </form>
        </MainColumn>
    );
};

// The design's primary Button in its loading state: the label changes, a spinner joins it, and
// the control is disabled for exactly as long as the request is out.
const SubmitButton = ({ isBusy }: { isBusy: boolean }): ReactElement => (
    <button
        className={styles.submit}
        type="submit"
        aria-busy={isBusy}
        disabled={isBusy}
        data-testid={SignupTestIds.Submit}
    >
        {isBusy ? <span className={styles.spinner} aria-hidden="true" /> : undefined}
        {isBusy ? SUBMITTING_LABEL : SUBMIT_LABEL}
    </button>
);
