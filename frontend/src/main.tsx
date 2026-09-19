// Composition root: providers and the browser router are assembled here and nowhere else.
import { StrictMode } from 'react';
import { BrowserRouter } from 'react-router';
import { createRoot } from 'react-dom/client';

import { App } from '~/App';
import { ErrorBoundary } from '~/components/ErrorBoundary';

// The type family, self-hosted: the page never waits on a font origin it does not control.
import '@fontsource-variable/source-sans-3';

import '~/styles/global.scss';

const container = document.getElementById('root');
if (container === null) {
    throw new Error('main: #root element is missing from index.html');
}

// The boundary wraps the router, not a screen inside it: a throw anywhere below — including
// one from routing itself — otherwise leaves a blank document (BF69). It is wired here and not
// inside `App` so a component that throws in a test still fails the test loudly, instead of
// being caught and rendered as the failure panel.
createRoot(container).render(
    <StrictMode>
        <ErrorBoundary>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </ErrorBoundary>
    </StrictMode>,
);
