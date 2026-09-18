// Wire → model. The DTO type is the API's shape and lives here.

import type { VisitorModel } from '~/models/visitor/model';

export type VisitorDTO = {
    id: string;
    assignments: Record<string, string>;
};

export const fromDTO = (dto: VisitorDTO): VisitorModel => ({
    id: dto.id,
    assignments: { ...dto.assignments },
});
