// Types only. A visitor is an id the page keeps and, per flag, the variant they were assigned.

export type VisitorModel = {
    id: string;
    // `{ flagKey: variantKey }`. A flag that was disabled when the visitor arrived is absent.
    assignments: Record<string, string>;
};
