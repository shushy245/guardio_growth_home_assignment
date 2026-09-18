// The visitor session: who this visitor is and which variant of each flag they were assigned.
// One provider at the root; pages read it through `useVisitor` (the hook is the port, the
// provider the adapter).
import { createContext, type ReactElement, type ReactNode, useContext, useEffect, useRef, useState } from 'react';

import { loadVisitorSession, type VisitorState, VisitorStatus } from '~/providers/VisitorProvider.utils';

const VisitorContext = createContext<VisitorState | undefined>(undefined);

export const VisitorProvider = ({ children }: { children: ReactNode }): ReactElement => {
    const [state, setState] = useState<VisitorState>({ status: VisitorStatus.Loading });
    // StrictMode runs the effect, cleans it up and runs it again on the same instance. A ref
    // survives that round trip where an effect-local variable would not, so the second run
    // joins the request already in flight instead of creating a second visitor.
    const inFlight = useRef<Promise<VisitorState> | undefined>(undefined);

    useEffect(() => {
        const load = inFlight.current ?? loadVisitorSession();
        inFlight.current = load;
        void load.then(setState);
    }, []);

    return <VisitorContext.Provider value={state}>{children}</VisitorContext.Provider>;
};

export const useVisitor = (): VisitorState => {
    const state = useContext(VisitorContext);
    if (state === undefined) {
        throw new Error('useVisitor: no VisitorProvider above this component — add it in the composition root');
    }

    return state;
};
