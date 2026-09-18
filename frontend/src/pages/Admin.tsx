// The flag console. Barely designed on purpose: it exists so product can retune the running
// experiment — the split, the copy, whether it runs at all — without a redeploy.
//
// There is no login. The operator pastes the admin token into the field at the top and it lives
// in React state for this tab only: never in the Vite build, which would ship it to every
// visitor, and never in localStorage, which would leave it on the machine.
import { type ChangeEvent, type ReactElement, useEffect, useState } from 'react';

import { Column, MainColumn } from '~/ui/box';
import { describeError } from '~/api/http-client';
import { FlagEditor } from '~/components/FlagEditor';
import { fetchFeatureFlags } from '~/api/feature-flags';
import { type FeatureFlagModel, replaceFlag, setLockTokenIn } from '~/models/featureFlag';
import { type AdminState, AdminTestIds, isFailedToLoad, isReady, LoadStatus } from '~/pages/Admin.utils';

import styles from '~/pages/Admin.module.scss';

export const Admin = (): ReactElement => {
    const [state, setState] = useState<AdminState>({ status: LoadStatus.Loading });
    const [adminToken, setAdminToken] = useState('');
    // Bumped by Retry. A failed load used to be terminal — the only way back was a page reload,
    // which also threw away the token the operator had already pasted.
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        // Not an AbortSignal: the flag list is a plain read and the only thing that must not
        // happen is a state update after the operator has navigated away.
        let cancelled = false;
        setState({ status: LoadStatus.Loading });
        void fetchFeatureFlags()
            .then((flags) => {
                if (!cancelled) setState({ status: LoadStatus.Ready, flags });
            })
            .catch((error: unknown) => {
                if (!cancelled) setState({ status: LoadStatus.Failed, error: describeError(error) });
            });

        return (): void => {
            cancelled = true;
        };
    }, [attempt]);

    const handleAdminTokenChange = (event: ChangeEvent<HTMLInputElement>): void => {
        setAdminToken(event.target.value);
    };

    const handleRetry = (): void => {
        setAttempt((current) => current + 1);
    };

    const handleFlagChange = (flag: FeatureFlagModel): void => {
        setState((current) => (isReady(current) ? { ...current, flags: replaceFlag(current.flags, flag) } : current));
    };

    // The save answers with a token and nothing else, and it answers into whatever the operator
    // has typed by then — so the token is applied inside the functional update, to the current
    // list, never to a flag captured before the request went out.
    const handleFlagSaved = (saved: { flagKey: string; lockToken: string }): void => {
        setState((current) =>
            isReady(current) ? { ...current, flags: setLockTokenIn(current.flags, saved) } : current,
        );
    };

    return (
        <MainColumn className={styles.page} data-testid={AdminTestIds.Page}>
            <Intro />
            {/* Mounted in every state, including the failed one: it holds what the operator
                typed, and unmounting it on a backend hiccup loses that. */}
            <label className={styles.field}>
                <span className={styles.label}>{`Admin token`}</span>
                <input
                    className={styles.input}
                    type="password"
                    autoComplete="off"
                    data-testid={AdminTestIds.AdminToken}
                    value={adminToken}
                    onChange={handleAdminTokenChange}
                />
            </label>
            <Flags
                state={state}
                adminToken={adminToken}
                onChange={handleFlagChange}
                onSaved={handleFlagSaved}
                onRetry={handleRetry}
            />
        </MainColumn>
    );
};

const Intro = (): ReactElement => (
    <Column className={styles.intro}>
        <h1 className={styles.title}>{`Feature flags`}</h1>
        <p className={styles.note}>
            {`Changes take effect immediately for visitors arriving after the save. Visitors already assigned keep the variant they were given.`}
        </p>
    </Column>
);

const Flags = ({
    state,
    adminToken,
    onChange,
    onSaved,
    onRetry,
}: {
    state: AdminState;
    adminToken: string;
    onChange: (flag: FeatureFlagModel) => void;
    onSaved: (saved: { flagKey: string; lockToken: string }) => void;
    onRetry: () => void;
}): ReactElement => {
    if (isFailedToLoad(state)) {
        return (
            <Column className={styles.intro}>
                <p className={styles.message} role="status" data-testid={AdminTestIds.LoadError}>
                    {`Could not load the flags: ${state.error}`}
                </p>
                <button className={styles.retry} type="button" data-testid={AdminTestIds.Retry} onClick={onRetry}>
                    {`Try again`}
                </button>
            </Column>
        );
    }

    if (!isReady(state)) {
        return <p className={styles.message} role="status" data-testid={AdminTestIds.Loading}>{`Loading flags…`}</p>;
    }

    return (
        <Column className={styles.flags}>
            {state.flags.map((flag) => (
                <FlagEditor key={flag.key} flag={flag} adminToken={adminToken} onChange={onChange} onSaved={onSaved} />
            ))}
        </Column>
    );
};
