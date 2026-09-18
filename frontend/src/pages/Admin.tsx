// The flag console. Barely designed on purpose: it exists so product can retune the running
// experiment — the split, the copy, whether it runs at all — without a redeploy.
//
// There is no login. The operator pastes the admin token into the field at the top and it lives
// in React state for this tab only: never in the Vite build, which would ship it to every
// visitor, and never in localStorage, which would leave it on the machine.
import { type ChangeEvent, type ReactElement, useEffect, useState } from 'react';

import { Column, Row } from '~/ui/box';
import { describeError, statusOfError } from '~/api/http-client';
import { fetchFeatureFlags, updateFeatureFlag } from '~/api/feature-flags';
import {
    type FeatureFlagModel,
    type FeatureFlagVariantModel,
    CopyField,
    hasCompleteSplit,
    replaceFlag,
    setLockToken,
    setVariantCopy,
    setVariantWeight,
    toggleEnabled,
    totalWeight,
    WEIGHT_TOTAL,
} from '~/models/featureFlag';
import {
    type AdminState,
    type SaveState,
    AdminTestIds,
    flagFieldTestId,
    FlagField,
    isFailedToLoad,
    isReady,
    isSaving,
    LoadStatus,
    MISSING_TOKEN_MESSAGE,
    saveMessage,
    SaveStatus,
    variantFieldTestId,
    WEIGHT_FIELD,
} from '~/pages/Admin.utils';

import styles from '~/pages/Admin.module.scss';

const HTTP_CONFLICT = 409;

const copyLabelMap: Record<CopyField, string> = {
    [CopyField.Headline]: 'Headline',
    [CopyField.Subheadline]: 'Subheadline',
    [CopyField.CtaLabel]: 'Button label',
};

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

const FlagEditor = ({
    flag,
    adminToken,
    onChange,
}: {
    flag: FeatureFlagModel;
    adminToken: string;
    onChange: (flag: FeatureFlagModel) => void;
}): ReactElement => {
    const [save, setSave] = useState<SaveState>({ status: SaveStatus.Idle });

    const handleToggleEnabled = (): void => {
        onChange(toggleEnabled(flag));
    };

    const handleVariantChange = (variant: FeatureFlagModel): void => {
        onChange(variant);
    };

    const handleSave = (): void => {
        if (adminToken === '') {
            setSave({ status: SaveStatus.Failed, error: MISSING_TOKEN_MESSAGE });

            return;
        }
        setSave({ status: SaveStatus.Saving });
        void updateFeatureFlag({ flag, adminToken })
            .then((lockToken) => {
                // Don't read after write: the server returns only the new token, and the values
                // on screen are the ones we just sent.
                onChange(setLockToken(flag, lockToken));
                setSave({ status: SaveStatus.Saved });
            })
            .catch((error: unknown) => {
                if (statusOfError(error) === HTTP_CONFLICT) {
                    setSave({ status: SaveStatus.Conflict });

                    return;
                }
                setSave({ status: SaveStatus.Failed, error: describeError(error) });
            });
    };

    const message = saveMessage(save);

    return (
        <Column className={styles.flag}>
            <h2 className={styles.flagName}>{flag.key}</h2>
            <p className={styles.note}>{flag.description}</p>
            <Row className={styles.toggle}>
                <input
                    className={styles.checkbox}
                    type="checkbox"
                    data-testid={flagFieldTestId({ flagKey: flag.key, field: FlagField.Enabled })}
                    checked={flag.isEnabled}
                    onChange={handleToggleEnabled}
                />
                <span>{`Running — assign new visitors to a variant`}</span>
            </Row>
            <Row className={styles.variants}>
                {flag.variants.map((variant) => (
                    <VariantEditor key={variant.key} flag={flag} variant={variant} onChange={handleVariantChange} />
                ))}
            </Row>
            <SplitNote flag={flag} />
            <button
                className={styles.save}
                type="button"
                data-testid={flagFieldTestId({ flagKey: flag.key, field: FlagField.Save })}
                disabled={isSaving(save)}
                onClick={handleSave}
            >
                {`Save`}
            </button>
            <p
                className={styles.message}
                data-testid={flagFieldTestId({ flagKey: flag.key, field: FlagField.SaveMessage })}
            >
                {message}
            </p>
        </Column>
    );
};

const SplitNote = ({ flag }: { flag: FeatureFlagModel }): ReactElement => {
    if (hasCompleteSplit(flag)) {
        return <p className={styles.note}>{`Traffic split: ${totalWeight(flag)}% assigned.`}</p>;
    }

    return (
        <p className={styles.warning}>
            {`The weights add up to ${totalWeight(flag)}%, not ${WEIGHT_TOTAL}% — saving will be rejected.`}
        </p>
    );
};

const VariantEditor = ({
    flag,
    variant,
    onChange,
}: {
    flag: FeatureFlagModel;
    variant: FeatureFlagVariantModel;
    onChange: (flag: FeatureFlagModel) => void;
}): ReactElement => {
    const handleWeightChange = (event: ChangeEvent<HTMLInputElement>): void => {
        const weight = Number.parseInt(event.target.value, 10);
        onChange(setVariantWeight(flag, { variantKey: variant.key, weight: Number.isNaN(weight) ? 0 : weight }));
    };

    const handleCopyChange = ({ field, value }: { field: CopyField; value: string }): void => {
        onChange(setVariantCopy(flag, { variantKey: variant.key, field, value }));
    };

    return (
        <Column className={styles.variant}>
            <h3 className={styles.variantName}>{variant.key}</h3>
            <label className={styles.field}>
                <span className={styles.label}>{`Share of traffic (%)`}</span>
                <input
                    className={styles.input}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={WEIGHT_TOTAL}
                    data-testid={variantFieldTestId({
                        flagKey: flag.key,
                        variantKey: variant.key,
                        field: WEIGHT_FIELD,
                    })}
                    value={variant.weight}
                    onChange={handleWeightChange}
                />
            </label>
            {Object.values(CopyField).map((field) => (
                <CopyFieldEditor
                    key={field}
                    flagKey={flag.key}
                    variantKey={variant.key}
                    field={field}
                    value={variant.config[field]}
                    onChange={handleCopyChange}
                />
            ))}
        </Column>
    );
};

const CopyFieldEditor = ({
    flagKey,
    variantKey,
    field,
    value,
    onChange,
}: {
    flagKey: string;
    variantKey: string;
    field: CopyField;
    value: string;
    onChange: (change: { field: CopyField; value: string }) => void;
}): ReactElement => {
    const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
        onChange({ field, value: event.target.value });
    };

    return (
        <label className={styles.field}>
            <span className={styles.label}>{copyLabelMap[field]}</span>
            <input
                className={styles.input}
                type="text"
                data-testid={variantFieldTestId({ flagKey, variantKey, field })}
                value={value}
                onChange={handleChange}
            />
        </label>
    );
};
