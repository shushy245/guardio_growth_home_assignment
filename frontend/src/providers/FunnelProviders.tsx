// The funnel's provider stack. The visitor session belongs to the funnel and to nothing else: at
// the router root it enrolled whoever opened /admin in the running experiment — a visitor row with
// no events, under a variant nobody saw — and fetched the flag list a second time behind the page's
// own read. Analytics sits inside it: a step cannot be posted until the visitor is known. The
// breach catalog sits inside both: the scan moment loads it and the result screen reads it, and
// it has to outlive the navigation between them.
//
// One component rather than JSX inline in `App`, because every funnel page driver renders its
// subject under exactly this stack — a page is tested beneath what production puts above it.
import type { ReactElement, ReactNode } from 'react';

import { VisitorProvider } from '~/providers/VisitorProvider';
import { AnalyticsProvider } from '~/providers/AnalyticsProvider';
import { BreachCatalogProvider } from '~/providers/BreachCatalogProvider';

export const FunnelProviders = ({ children }: { children: ReactNode }): ReactElement => (
    <VisitorProvider>
        <AnalyticsProvider>
            <BreachCatalogProvider>{children}</BreachCatalogProvider>
        </AnalyticsProvider>
    </VisitorProvider>
);
