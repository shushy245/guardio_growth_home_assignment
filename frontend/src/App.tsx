import { ReactElement } from 'react';
import { Outlet, Route, Routes } from 'react-router';

import { Admin } from '~/pages/Admin';
import { Landing } from '~/pages/Landing';
import { VisitorProvider } from '~/providers/VisitorProvider';

export const App = (): ReactElement => (
    <Routes>
        <Route element={<Funnel />}>
            <Route path="/" element={<Landing />} />
        </Route>
        <Route path="/admin" element={<Admin />} />
    </Routes>
);

// The visitor session belongs to the funnel and to nothing else. At the router root it enrolled
// whoever opened /admin in the running experiment — a visitor row with no events, under a
// variant nobody saw — and fetched the flag list a second time behind the page's own read.
const Funnel = (): ReactElement => (
    <VisitorProvider>
        <Outlet />
    </VisitorProvider>
);
