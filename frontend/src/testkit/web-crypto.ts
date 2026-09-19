// The one place a test takes Web Crypto away: plain http off localhost leaves `crypto.subtle`
// undefined (the S4 finding for `randomUUID`), and a driver that proves the field survives it
// shadows the getter on the instance. The setup file restores it after every test, so no later
// test hashes in a browser that cannot.

export const removeWebCryptoSubtle = (): void => {
    Object.defineProperty(crypto, 'subtle', { configurable: true, get: (): undefined => undefined });
};

// Deleting an own property that was never defined is a no-op, so this is safe to call always.
export const restoreWebCryptoSubtle = (): void => {
    Reflect.deleteProperty(crypto, 'subtle');
};
