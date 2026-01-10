from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from pathlib import Path

class _BaseModel(BaseModel):
    model_config = ConfigDict(
        validate_by_name=True,
        validate_by_alias=True,
        serialize_by_alias=True,
        alias_generator=to_camel,
        extra="forbid",
    )


class DatasetItem(_BaseModel):
    image: Path
    caption: Path
    caption_str: str


class AppState(_BaseModel):
    folder: Path | None = None
    caption_prefix: str = ''
    items: list[DatasetItem] = []