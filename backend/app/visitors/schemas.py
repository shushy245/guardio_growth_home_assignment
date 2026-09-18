"""The wire contract for visitors: the id the page keeps, and which variant of each flag it
was assigned — `{ flagKey: variantKey }`, the shape `VisitorProvider` reads."""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class VisitorResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)

    id: str
    assignments: dict[str, str]
