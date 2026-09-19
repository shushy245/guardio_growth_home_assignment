import { ReactElement } from 'react';
import { Outlet, Route, Routes } from 'react-router';

import { Scan } from '~/pages/Scan';
import { Admin } from '~/pages/Admin';
import { Result } from '~/pages/Result';
import { Signup } from '~/pages/Signup';
import { Landing } from '~/pages/Landing';
import { RESULT_ROUTE } from '~/pages/Scan.utils';
import { SCAN_ROUTE } from '~/pages/Landing.utils';
import { SIGNUP_ROUTE } from '~/pages/Result.utils';
import { FunnelProviders } from '~/providers/FunnelProviders';

export const App = (): ReactElement => (
    <Routes>
        <Route element={<Funnel />}>
            <Route path="/" element={<Landing />} />
            <Route path={SCAN_ROUTE} element={<Scan />} />
            <Route path={RESULT_ROUTE} element={<Result />} />
            <Route path={SIGNUP_ROUTE} element={<Signup />} />
        </Route>
        <Route path="/admin" element={<Admin />} />
    </Routes>
);

// The layout route every funnel page renders under; /admin sits outside it on purpose (see
// FunnelProviders for why).
const Funnel = (): ReactElement => (
    <FunnelProviders>
        <Outlet />
    </FunnelProviders>
);
