// Records a step when the component that represents it mounts.
import { useEffect, useState } from 'react';

import { generateUniqueId } from '~/shared/ids.utils';
import type { FunnelEventName } from '~/models/funnelEvent';
import { useAnalytics } from '~/providers/AnalyticsProvider';

export const useTrackOnce = (name: FunnelEventName): void => {
    const { record } = useAnalytics();
    // One id per mount, minted once. StrictMode runs the effect, cleans it up and runs it again on
    // the same instance; both runs carry this id and the provider records it once. A remount is a
    // new instance and a new id — a revisit is a visit.
    const [id] = useState(() => generateUniqueId('evt'));

    useEffect(() => {
        record({ id, name });
    }, [record, id, name]);
};
