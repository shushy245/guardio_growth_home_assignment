// Builder for the visitor session as the pages read it: ready with an assignment, still
// loading, or failed. The wire builders make the models; this assembles the state around them.
//
// `with*` reassigns to a fresh object and never mutates in place: `build()` hands back the live
// state, so a mutation would rewrite a state a previous `build()` already returned.

import { aVisitorDTO } from '~/testkit/builders/visitor';
import { featureFlagModel, visitorModel } from '~/models';
import { aFeatureFlagDTO } from '~/testkit/builders/featureFlag';
import { type VisitorState, VisitorStatus } from '~/providers/VisitorProvider.utils';

const A_FAILURE = 'the session could not be created';

class VisitorStateBuilder {
    private state: VisitorState = {
        status: VisitorStatus.Ready,
        session: {
            visitor: visitorModel.fromDTO(aVisitorDTO().build()),
            flags: [featureFlagModel.fromDTO(aFeatureFlagDTO().build())],
        },
    };

    assignedTo({ flagKey, variantKey }: { flagKey: string; variantKey: string }): this {
        this.state = {
            status: VisitorStatus.Ready,
            session: {
                visitor: visitorModel.fromDTO(
                    aVisitorDTO().withoutAssignments().assignedTo(flagKey, variantKey).build(),
                ),
                flags: [featureFlagModel.fromDTO(aFeatureFlagDTO().build())],
            },
        };

        return this;
    }

    stillLoading(): this {
        this.state = { status: VisitorStatus.Loading };

        return this;
    }

    failed(): this {
        this.state = { status: VisitorStatus.Failed, error: A_FAILURE };

        return this;
    }

    build(): VisitorState {
        return this.state;
    }
}

export const aVisitorState = (): VisitorStateBuilder => new VisitorStateBuilder();
