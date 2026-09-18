// A breach row's testable surface: its ids and the pure step from a breach to its meta line. The
// component file exports only the component.

import { formatCount } from '~/shared/format.utils';
import { type BreachModel, breachYear } from '~/models/breach';

// A test id is its own access path (docs/testing-conventions.md §test ids): the string in the DOM
// is exactly what you grep for to find the code that renders it.
export enum BreachRowTestIds {
    Title = 'BreachRowTestIds.Title',
    Meta = 'BreachRowTestIds.Meta',
    Verified = 'BreachRowTestIds.Verified',
    Toggle = 'BreachRowTestIds.Toggle',
    Description = 'BreachRowTestIds.Description',
}

export const badgeTestId = (dataClass: string): string => `BreachRowTestIds.Badge.${dataClass}`;

const META_SEPARATOR = ' · ';

// `adobe.com · 2013 · 152.4M accounts`, with the domain left out when the record has none —
// never "unknown domain", which would be a fact the record does not state.
export const formatMetaLine = (breach: BreachModel): string =>
    [breach.domain, String(breachYear(breach)), `${formatCount(breach.pwnCount)} accounts`]
        .filter((part): part is string => part !== undefined)
        .join(META_SEPARATOR);

export const SHOW_DETAILS_LABEL = 'Show details';
export const HIDE_DETAILS_LABEL = 'Hide details';
export const VERIFIED_LABEL = 'Verified';
