// Builder for the visitor wire shape: an id and `{ flagKey: variantKey }`.

import type { VisitorDTO } from '~/models/visitor';

const A_VISITOR: VisitorDTO = {
    id: 'vis_01K5G6X0000000000000000000',
    assignments: { result_screen_tone: 'urgent' },
};

class VisitorDTOBuilder {
    private state: VisitorDTO = { ...A_VISITOR };

    withId(id: string): this {
        this.state = { ...this.state, id };

        return this;
    }

    assignedTo(flagKey: string, variantKey: string): this {
        this.state = { ...this.state, assignments: { ...this.state.assignments, [flagKey]: variantKey } };

        return this;
    }

    withoutAssignments(): this {
        this.state = { ...this.state, assignments: {} };

        return this;
    }

    build(): VisitorDTO {
        return this.state;
    }
}

export const aVisitorDTO = (): VisitorDTOBuilder => new VisitorDTOBuilder();
