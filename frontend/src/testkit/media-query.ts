// jsdom implements no media features, so `window.matchMedia` does not exist and any code that
// asks about one throws. This builds a real `MediaQueryList` — an EventTarget carrying the
// members the interface declares — rather than a shaped object behind a cast, so a member the
// interface gains is a compile error here instead of a crash at the call site.

export const aMediaQueryList = ({ media, matches }: { media: string; matches: boolean }): MediaQueryList =>
    Object.assign(new EventTarget(), {
        media,
        matches,
        onchange: (): void => {},
        addListener: (): void => {},
        removeListener: (): void => {},
    });
