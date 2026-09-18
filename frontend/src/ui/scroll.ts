// The one place `scrollIntoView` is called. Wrapped because the raw API is sharp in two ways: a
// ref may not have attached yet, and the argument shape is easy to get wrong in a way that
// scrolls the whole page instead of the element into the nearest edge.

export const bringIntoView = (element: HTMLElement | undefined): void => {
    if (element === undefined) return;

    element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
};
