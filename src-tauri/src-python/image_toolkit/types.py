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
    image_path: Path
    caption_path: Path
    tags: list[str]


class AppState(_BaseModel):
    folder: Path | None = None
    tags_prefix: list[str] = []
    items: list[DatasetItem] = []