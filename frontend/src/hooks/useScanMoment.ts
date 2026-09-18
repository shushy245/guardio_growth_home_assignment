// The scan moment: a minimum on the clock and the record in hand, whichever comes second. The
// timer is cleared on unmount, so a visitor who leaves mid-scan is never navigated from a page
// they are no longer on, and `onComplete` is never called for them.
import { useEffect, useState } from 'react';

import { SCAN_MOMENT_MS } from '~/pages/Scan.utils';

export const useScanMoment = ({
    isCatalogReady,
    onComplete,
}: {
    isCatalogReady: boolean;
    onComplete: () => void;
}): void => {
    const [hasElapsed, setHasElapsed] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setHasElapsed(true);
        }, SCAN_MOMENT_MS);

        return (): void => {
            clearTimeout(timer);
        };
    }, []);

    useEffect(() => {
        if (!hasElapsed) return;
        if (!isCatalogReady) return;
        onComplete();
    }, [hasElapsed, isCatalogReady, onComplete]);
};
