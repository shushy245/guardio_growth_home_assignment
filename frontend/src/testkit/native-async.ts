// Web Crypto's `digest` completes on Node's thread pool — a later turn of the event loop, not a
// microtask — so `act` alone cannot settle a chain that starts with a hash. Draining a few
// immediates lets that turn happen while `setTimeout` stays faked; the hash itself is instant,
// so a handful is plenty and the count is not a timing guess.

const NATIVE_ASYNC_ROUNDS = 5;

const nextImmediate = (): Promise<void> =>
    new Promise<void>((resolve) => {
        setImmediate(resolve);
    });

export const settleNativeAsyncWork = (): Promise<void> =>
    Array.from({ length: NATIVE_ASYNC_ROUNDS }).reduce<Promise<void>>(
        (chain) => chain.then(nextImmediate),
        Promise.resolve(),
    );
