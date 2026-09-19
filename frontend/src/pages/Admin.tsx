// The flag console. Barely designed on purpose: it exists so product can retune the running
// experiment — the split, the copy, whether it runs at all — without a redeploy.
//
// There is no login. The operator pastes the admin token into the field at the top and it lives
// in React state for this tab only: never in the Vite build, which would ship it to every
// visitor, and never in localStorage, which would leave it on the machine.
import { type ChangeEvent, type ReactElement, useState } from 'react';

import { Column, MainColumn } from '~/ui/box';
import { FlagEditor } from '~/components/FlagEditor';
import { useLoadedState } from '~/hooks/useLoadedState';
import { type FeatureFlagModel, replaceFlag, setLockTokenIn } from '~/models/featureFlag';
import {
    type AdminState,
    AdminTestIds,
    isFailedToLoad,
    isReady,
    LOAD_FAILED_MESSAGE,
    LOADING,
    loadFlags,
} from '~/pages/Admin.utils';

import styles from '~/pages/Admin.module.scss';

export const Admin = (): ReactElement => {
    // One load shape for the two mount-time loads in this app (`useLoadedState`): the list is
    // asked for once however many times StrictMode mounts the page — it fetched twice before
    // (BF58) — and Retry asks again without throwing away the token the operator has pasted.
    const { state, setState, reload } = useLoadedState({ load: loadFlags, loading: LOADING });
    const [adminToken, setAdminToken] = useState('');

    const handleAdminTokenChange = (event: ChangeEvent<HTMLInputElement>): void => {
        setAdminToken(event.target.value);
    };

    const handleRetry = (): void => {
        reload();
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
                <p className={styles.messageError} role="alert" data-testid={AdminTestIds.LoadError}>
                    {LOAD_FAILED_MESSAGE}
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
