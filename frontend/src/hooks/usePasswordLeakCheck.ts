// Runs the k-anonymity check on whatever is in the password box, once the visitor pauses. The
// result is keyed to the password it checked (`PasswordCheck`), so the page can tell a warning
// for the current password from one for a password since edited.
//
// Each change of password cancels what the previous one started — the pause timer, the hash,
// the request — so an older range can never answer over a newer one: axios rejects an aborted
// request even when its answer arrived, and `isCurrent` covers the hash step before it.
import { useEffect, useState } from 'react';

import { logger } from '~/logging/logger';
import { fetchPwnedRange } from '~/api/pwned-passwords';
import { describeError, isCancelled } from '~/api/http-client';
import {
    findSuffixCount,
    IDLE_CHECK,
    isTooShort,
    PASSWORD_CHECK_DEBOUNCE_MS,
    type PasswordCheck,
    PasswordCheckStatus,
    sha1Hex,
    splitHash,
} from '~/components/PasswordField.utils';

// A password too short to submit is not worth a request; the check starts at the floor.
const isWorthChecking = (password: string): boolean => password !== '' && !isTooShort(password);

const checkPassword = async ({
    password,
    signal,
}: {
    password: string;
    signal: AbortSignal;
}): Promise<PasswordCheck> => {
    try {
        const { prefix, suffix } = splitHash(await sha1Hex(password));
        const count = findSuffixCount({ rangeText: await fetchPwnedRange({ prefix, signal }), suffix });
        if (count === undefined) return { status: PasswordCheckStatus.Clean, password };

        return { status: PasswordCheckStatus.Leaked, password, count };
    } catch (error) {
        // Never a clean bill the check did not earn: a failure is "couldn't check", said softly.
        if (!isCancelled(error)) {
            logger.error('checkPassword: the leak check could not run', { detail: describeError(error) });
        }

        return { status: PasswordCheckStatus.Unchecked, password };
    }
};

export const usePasswordLeakCheck = (password: string): PasswordCheck => {
    const [check, setCheck] = useState<PasswordCheck>(IDLE_CHECK);

    useEffect(() => {
        if (!isWorthChecking(password)) {
            setCheck(IDLE_CHECK);

            return;
        }
        setCheck({ status: PasswordCheckStatus.Checking, password });
        const controller = new AbortController();
        let isCurrent = true;
        const timer = setTimeout(() => {
            void checkPassword({ password, signal: controller.signal }).then((result) => {
                if (isCurrent) setCheck(result);
            });
        }, PASSWORD_CHECK_DEBOUNCE_MS);

        return (): void => {
            isCurrent = false;
            clearTimeout(timer);
            controller.abort();
        };
    }, [password]);

    return check;
};
