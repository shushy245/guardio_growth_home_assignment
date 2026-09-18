// The one place `scrollIntoView` is called. Wrapped because the raw API is sharp in three ways: a
// ref may not have attached yet, the argument shape is easy to get wrong in a way that scrolls the
// whole page instead of the element into the nearest edge, and `behavior: 'smooth'` is motion that
// an operating-system setting may have asked us not to produce.

const prefersReducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const bringIntoView = (element: HTMLElement | undefined): void => {
    if (element === undefined) return;

    element.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
};
