// One flag's editor: the split, the copy each variant serves, whether the flag runs at all, and
// the optimistic-lock round trip that saves them. The page above it owns the list of flags and
// the admin token; this owns the save.
import { type ChangeEvent, type ReactElement, useEffect, useRef, useState } from 'react';

import { Column } from '~/ui/box';
import { logger } from '~/logging/logger';
import { bringIntoView } from '~/ui/scroll';
import { updateFeatureFlag } from '~/api/feature-flags';
import { describeError, statusOfError } from '~/api/http-client';
import {
    type FeatureFlagModel,
    type FeatureFlagVariantModel,
    CopyField,
    hasCompleteSplit,
    setVariantCopy,
    setVariantWeight,
    toggleEnabled,
    totalWeight,
    WEIGHT_TOTAL,
} from '~/models/featureFlag';
import {
    canSave,
    clampWeight,
    isAnswered,
    copyLabelMap,
    flagFieldTestId,
    FlagField,
    HTTP_CONFLICT,
    isSaving,
    missingTokenHint,
    saveMessage,
    SaveStatus,
    variantFieldTestId,
    WEIGHT_FIELD,
} from '~/components/FlagEditor.utils';

import styles from '~/components/FlagEditor.module.scss';

export const FlagEditor = ({
    flag,
    adminToken,
    onChange,
    onSaved,
}: {
    flag: FeatureFlagModel;
    adminToken: string;
    onChange: (flag: FeatureFlagModel) => void;
    onSaved: (saved: { flagKey: string; lockToken: string }) => void;
}): ReactElement => {
    const [save, setSave] = useState<SaveStatus>(SaveStatus.Idle);
    // Save sits below the fold of a long flag at 390 and at 1280, so the answer to a click can
    // land entirely off screen — the click reads as having done nothing at all.
    const messageRef = useRef<HTMLParagraphElement | undefined>(undefined);

    useEffect(() => {
        if (!isAnswered(save)) return;
        bringIntoView(messageRef.current);
    }, [save]);

    const handleMessageRef = (node: HTMLParagraphElement | null): void => {
        messageRef.current = node ?? undefined;
    };

    // Any edit invalidates the last answer: "Saved." standing beside a field the operator has
    // since changed claims the value on screen is the value stored. A save still in flight keeps
    // its state — it is what disables the button, and re-enabling it mid-request would let a
    // second save overlap the first.
    const handleFlagEdited = (edited: FeatureFlagModel): void => {
        setSave((current) => (isSaving(current) ? current : SaveStatus.Idle));
        onChange(edited);
    };

    const handleToggleEnabled = (): void => {
        handleFlagEdited(toggleEnabled(flag));
    };

    const handleSave = (): void => {
        setSave(SaveStatus.Saving);
        void updateFeatureFlag({ flag, adminToken })
            .then((lockToken) => {
                // Don't read after write: the server returns only the new token, so only the
                // token is applied. Handing back the flag captured at click time would write a
                // snapshot over whatever the operator typed during the round trip.
                onSaved({ flagKey: flag.key, lockToken });
                setSave(SaveStatus.Saved);
            })
            .catch((error: unknown) => {
                if (statusOfError(error) === HTTP_CONFLICT) {
                    setSave(SaveStatus.Conflict);

                    return;
                }
                logger.error('FlagEditor.handleSave: the save failed', {
                    flagKey: flag.key,
                    detail: describeError(error),
                });
                setSave(SaveStatus.Failed);
            });
    };

    const message = saveMessage(save) ?? missingTokenHint(adminToken);

    return (
        <Column className={styles.flag}>
            <h2 className={styles.flagName}>{flag.key}</h2>
            <p className={styles.note}>{flag.description}</p>
            {/* The input lives inside its label: that is what gives the control an accessible
                name, and what makes the words beside it part of the same 44px target. */}
            <label className={styles.toggle}>
                <input
                    className={styles.checkbox}
                    type="checkbox"
                    data-testid={flagFieldTestId({ flagKey: flag.key, field: FlagField.Enabled })}
                    checked={flag.isEnabled}
                    onChange={handleToggleEnabled}
                />
                <span>{`Running — assign new visitors to a variant`}</span>
            </label>
            <Column className={styles.variants}>
                {flag.variants.map((variant) => (
                    <VariantEditor key={variant.key} flag={flag} variant={variant} onChange={handleFlagEdited} />
                ))}
            </Column>
            <SplitNote flag={flag} />
            <button
                className={styles.save}
                type="button"
                data-testid={flagFieldTestId({ flagKey: flag.key, field: FlagField.Save })}
                disabled={!canSave({ save, flag, adminToken })}
                onClick={handleSave}
            >
                {`Save`}
            </button>
            {/* Saving, saved, rejected and conflict all replace the text in this one slot; a
                live region is what makes that a change a screen reader hears. */}
            <p
                ref={handleMessageRef}
                className={styles.message}
                role="status"
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
        onChange(setVariantWeight(flag, { variantKey: variant.key, weight: clampWeight(event.target.value) }));
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
