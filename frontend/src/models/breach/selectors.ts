// The model's public API: what its data means, named. Call sites read these, never the fields.

import type { BreachModel } from '~/models/breach/model';
import { PASSWORDS_DATA_CLASS } from '~/models/breach/model';

export const hasLeakedPasswords = (breach: BreachModel): boolean => breach.dataClasses.includes(PASSWORDS_DATA_CLASS);

export const breachYear = (breach: BreachModel): number => breach.breachDate.getFullYear();

export const isSensitive = (breach: BreachModel): boolean => breach.isSensitive;
