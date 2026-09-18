// The model's public API: what its data means, named. Call sites read these, never the fields.

import type { BreachModel } from '~/models/breach/model';
import { PASSWORDS_DATA_CLASS } from '~/models/breach/model';

export const hasLeakedPasswords = (breach: BreachModel): boolean => breach.dataClasses.includes(PASSWORDS_DATA_CLASS);

export const breachYear = (breach: BreachModel): number => breach.breachDate.getFullYear();

// One data class, as a badge asks: is this the one that means a password is out there?
export const isPasswordsDataClass = (dataClass: string): boolean => dataClass === PASSWORDS_DATA_CLASS;

// The first letter of the title stands in for a logo, as the design draws it.
export const breachInitial = (breach: BreachModel): string => breach.title.charAt(0).toUpperCase();
