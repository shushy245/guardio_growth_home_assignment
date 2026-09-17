// Composition root: providers and the browser router are assembled here and nowhere else.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { App } from '~/App';

const container = document.getElementById('root');
if (container === null) {
    throw new Error('main: #root element is missing from index.html');
}

createRoot(container).render(
    <StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </StrictMode>,
);
