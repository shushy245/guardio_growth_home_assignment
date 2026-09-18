// The one place the reduced-motion preference is read. Every animation the app runs — a scroll, a
// count-up, a shimmer set from script — asks here, so the operating-system setting is honoured in
// one way everywhere rather than remembered per call site.

export const prefersReducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
