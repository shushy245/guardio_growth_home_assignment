// Web Crypto's `digest` completes on Node's thread pool — a later turn of the event loop, not a
// microtask — so `act` alone cannot settle a chain that starts with a hash. Draining immediates
// lets those turns happen while `setTimeout` stays faked.
//
// The count is a ceiling, not a duration: every round is one event-loop turn and an already
// settled chain costs nothing, so the number only has to be larger than the turns the pool
// needs. Five was too close to that line — StrictMode mounts the field twice, so two digests
// are queued, and the commit gate (which runs both suites at once) failed the leak-warning case
// on a machine under load. Raised rather than made condition-based because there is nothing to
// observe: the digest's completion is not visible until the state it sets is.

const NATIVE_ASYNC_ROUNDS = 40;

const nextImmediate = (): Promise<void> =>
    new Promise<void>((resolve) => {
        setImmediate(resolve);
    });

export const settleNativeAsyncWork = (): Promise<void> =>
    Array.from({ length: NATIVE_ASYNC_ROUNDS }).reduce<Promise<void>>(
        (chain) => chain.then(nextImmediate),
        Promise.resolve(),
    );
