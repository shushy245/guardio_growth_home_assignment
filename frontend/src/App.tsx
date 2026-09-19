import { ReactElement } from 'react';
import { Outlet, Route, Routes } from 'react-router';

import { Scan } from '~/pages/Scan';
import { Admin } from '~/pages/Admin';
import { Result } from '~/pages/Result';
import { Signup } from '~/pages/Signup';
import { Landing } from '~/pages/Landing';
import { Dashboard } from '~/pages/Dashboard';
import { Protected } from '~/pages/Protected';
import { RESULT_ROUTE } from '~/pages/Scan.utils';
import { SCAN_ROUTE } from '~/pages/Landing.utils';
import { SIGNUP_ROUTE } from '~/pages/Result.utils';
import { PROTECTED_ROUTE } from '~/pages/Signup.utils';
import { DASHBOARD_ROUTE } from '~/pages/Dashboard.utils';
import { FunnelProviders } from '~/providers/FunnelProviders';

export const App = (): ReactElement => (
    <Routes>
        <Route element={<Funnel />}>
            <Route path="/" element={<Landing />} />
            <Route path={SCAN_ROUTE} element={<Scan />} />
            <Route path={RESULT_ROUTE} element={<Result />} />
            <Route path={SIGNUP_ROUTE} element={<Signup />} />
            <Route path={PROTECTED_ROUTE} element={<Protected />} />
        </Route>
        <Route path="/admin" element={<Admin />} />
        <Route path={DASHBOARD_ROUTE} element={<Dashboard />} />
    </Routes>
);

// The layout route every funnel page renders under; /admin and /dashboard sit outside it on
// purpose (see FunnelProviders for why).
const Funnel = (): ReactElement => (
    <FunnelProviders>
        <Outlet />
    </FunnelProviders>
);
