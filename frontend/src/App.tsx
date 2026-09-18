import { ReactElement } from 'react';
import { Route, Routes } from 'react-router';

import { Admin } from '~/pages/Admin';
import { Landing } from '~/pages/Landing';

export const App = (): ReactElement => (
    <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/admin" element={<Admin />} />
    </Routes>
);
