import { ReactElement } from 'react';
import { Route, Routes } from 'react-router';

import { Landing } from '~/pages/Landing';

export const App = (): ReactElement => (
    <Routes>
        <Route path="/" element={<Landing />} />
    </Routes>
);
