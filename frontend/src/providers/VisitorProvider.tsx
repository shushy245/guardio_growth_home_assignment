// The visitor session: who this visitor is and which variant of each flag they were assigned.
// One provider at the root; pages read it through `useVisitor` (the hook is the port, the
// provider the adapter).
import { createContext, type ReactElement, type ReactNode, useContext } from 'react';

import { useLoadedState } from '~/hooks/useLoadedState';
import { LOADING, loadVisitorSession, type VisitorState } from '~/providers/VisitorProvider.utils';

const VisitorContext = createContext<VisitorState | undefined>(undefined);

export const VisitorProvider = ({ children }: { children: ReactNode }): ReactElement => {
    // The same one-shot load shape the admin page uses: the session is created once however
    // many times StrictMode mounts the provider — two runs would be two visitors — and the
    // answer to a provider that has since unmounted is applied to nothing (BF70).
    const { state } = useLoadedState({ load: loadVisitorSession, loading: LOADING });

    return <VisitorContext.Provider value={state}>{children}</VisitorContext.Provider>;
};

export const useVisitor = (): VisitorState => {
    const state = useContext(VisitorContext);
    if (state === undefined) {
        throw new Error('useVisitor: no VisitorProvider above this component — add it in the composition root');
    }

    return state;
};
