// Named reads over a visitor's assignments.

import type { VisitorModel } from '~/models/visitor/model';

export const assignedVariantKey = (visitor: VisitorModel, flagKey: string): string | undefined =>
    visitor.assignments[flagKey];
