// The flag console. Barely designed on purpose: it exists so product can retune the running
// experiment — the split, the copy, whether it runs at all — without a redeploy.
//
// There is no login. The operator pastes the admin token into the field at the top and it lives
// in React state for this tab only: never in the Vite build, which would ship it to every
// visitor, and never in localStorage, which would leave it on the machine.
import { type ChangeEvent, type ReactElement, useEffect, useState } from 'react';

import { Column } from '~/ui/box';
import { describeError } from '~/api/http-client';
import { FlagEditor } from '~/components/FlagEditor';
import { fetchFeatureFlags } from '~/api/feature-flags';
import { type FeatureFlagModel, replaceFlag } from '~/models/featureFlag';
import { type AdminState, AdminTestIds, isFailedToLoad, isReady, LoadStatus } from '~/pages/Admin.utils';

import styles from '~/pages/Admin.module.scss';

export const Admin = (): ReactElement => {
    const [state, setState] = useState<AdminState>({ status: LoadStatus.Loading });
    const [adminToken, setAdminToken] = useState('');

    useEffect(() => {
        // Not an AbortSignal: the flag list is a plain read and the only thing that must not
        // happen is a state update after the operator has navigated away.
        let cancelled = false;
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
    }, []);

    const handleAdminTokenChange = (event: ChangeEvent<HTMLInputElement>): void => {
        setAdminToken(event.target.value);
    };

    const handleFlagChange = (flag: FeatureFlagModel): void => {
        setState((current) => (isReady(current) ? { ...current, flags: replaceFlag(current.flags, flag) } : current));
    };

    if (isFailedToLoad(state)) {
        return (
            <Column className={styles.page} data-testid={AdminTestIds.Page}>
                <Intro />
                <p className={styles.message} data-testid={AdminTestIds.LoadError}>
                    {`Could not load the flags: ${state.error}`}
                </p>
            </Column>
        );
    }

    if (!isReady(state)) {
        return (
            <Column className={styles.page} data-testid={AdminTestIds.Page}>
                <Intro />
                <p className={styles.message} data-testid={AdminTestIds.Loading}>{`Loading flags…`}</p>
            </Column>
        );
    }

    return (
        <Column className={styles.page} data-testid={AdminTestIds.Page}>
            <Intro />
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
            {state.flags.map((flag) => (
                <FlagEditor key={flag.key} flag={flag} adminToken={adminToken} onChange={handleFlagChange} />
            ))}
        </Column>
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
