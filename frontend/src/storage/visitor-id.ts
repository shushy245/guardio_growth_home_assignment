// The browser-side mirror of the visitor id. The cookie is HttpOnly, so the page can never read
// it; this is how a returning visitor asks for their own assignments instead of a new identity.
// localStorage can throw (private windows, blocked site data), so every access is guarded and
// an unreadable store reads as "no visitor yet".

const VISITOR_ID_KEY = 'breach-scan.visitorId';

export const readStoredVisitorId = (): string | undefined => {
    try {
        return window.localStorage.getItem(VISITOR_ID_KEY) ?? undefined;
    } catch {
        return undefined;
    }
};

export const storeVisitorId = (id: string): void => {
    try {
        window.localStorage.setItem(VISITOR_ID_KEY, id);
    } catch {
        // A visitor whose browser refuses storage is re-created on the next visit; nothing to do.
    }
};

export const forgetVisitorId = (): void => {
    try {
        window.localStorage.removeItem(VISITOR_ID_KEY);
    } catch {
        // See storeVisitorId.
    }
};
