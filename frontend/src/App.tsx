import { ReactElement } from 'react';
import { Outlet, Route, Routes } from 'react-router';

import { Admin } from '~/pages/Admin';
import { Landing } from '~/pages/Landing';
import { FunnelProviders } from '~/providers/FunnelProviders';

export const App = (): ReactElement => (
    <Routes>
        <Route element={<Funnel />}>
            <Route path="/" element={<Landing />} />
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
