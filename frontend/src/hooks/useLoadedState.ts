// A value loaded once per attempt, reloadable, and safe across StrictMode's mount–unmount–mount.
//
// **The load is not aborted on cleanup, deliberately**, and this is the one place the difference
// between the two shapes is written down. StrictMode runs a mount effect, cleans it up and runs
// it again on the same component: a cleanup that aborted would either cancel the request the
// surviving run is waiting for, or leave that run to send a second one — which is what made the
// admin page fetch its flag list twice (BF58). So the request is held in a ref and the second run
// joins it, while only the run that is still mounted applies the answer.
//
// The other shape is an `AbortController` per effect, aborted on cleanup, as
// `BreachCatalogProvider` and the dashboard use it. That one is for a load that depends on
// changing inputs — filters, a page, a flag key — where an older request's answer is one nobody
// wants and the bytes are worth cancelling. A one-shot load at mount has neither property.
//
// Contract: `load` resolves with the state to show, **including its own failure state**, and
// never rejects. This hook has no opinion about what failed; its caller's loader does.
import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from 'react';

type Attempted<T> = { attempt: number; request: Promise<T> };

// `setState` is for what the screen does to the value *after* it has loaded — the admin page
// edits the flags it was given. A reload replaces whatever is there, which is what Retry means.
export type LoadedState<T> = { state: T; setState: Dispatch<SetStateAction<T>>; reload: () => void };

export const useLoadedState = <T>({ load, loading }: { load: () => Promise<T>; loading: T }): LoadedState<T> => {
    const [state, setState] = useState<T>(loading);
    const [attempt, setAttempt] = useState(0);
    const inFlight = useRef<Attempted<T> | undefined>(undefined);

    useEffect(() => {
        let isCurrent = true;
        const pending = inFlight.current;
        const request = pending !== undefined && pending.attempt === attempt ? pending.request : load();
        inFlight.current = { attempt, request };
        setState(loading);
        void request.then((loaded) => {
            if (isCurrent) setState(loaded);
        });

        return (): void => {
            isCurrent = false;
        };
        // `load` and `loading` are deliberately not dependencies: a caller that builds its
        // loader inline would otherwise reload on every render of the component above it.
    }, [attempt]);

    const reload = useCallback((): void => {
        setAttempt((current) => current + 1);
    }, []);

    return { state, setState, reload };
};
