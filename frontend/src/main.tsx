// Composition root: providers and the browser router are assembled here and nowhere else.
import { StrictMode } from 'react';
import { BrowserRouter } from 'react-router';
import { createRoot } from 'react-dom/client';

import { App } from '~/App';

// The type family, self-hosted: the page never waits on a font origin it does not control.
import '@fontsource-variable/source-sans-3';

import '~/styles/global.scss';

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
