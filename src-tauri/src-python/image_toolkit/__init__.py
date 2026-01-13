from anyio.from_thread import start_blocking_portal
from pydantic.alias_generators import to_camel
from pytauri import (
    Commands,
    builder_factory,
    context_factory,
    Manager,
    State
)
from pathlib import Path
from os import getenv
from typing import Annotated

from image_toolkit.utils import get_common_prefix, where, get_caption, copy
from image_toolkit.types import _BaseModel, AppState, DatasetItem
from image_toolkit.tools import (
    BrushTool, ConcatTool, ExpandTool, RectTool, SplitTool, TrimTool, ViewTool
)
from image_toolkit.batch_operations import (
    EscapeOperation, UnescapeOperation, AlignResolutionOperation, DeduplicateTagsOperation, ReplaceTagsOperation,
    RemoveTagsOperation, RemoveTransparencyOperation
)

PYTAURI_GEN_TS = getenv("PYTAURI_GEN_TS") != "0"

commands: Commands = Commands(experimental_gen_ts=PYTAURI_GEN_TS)


IMAGE_EXT = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}


@commands.command()
async def get_state(state: Annotated[AppState, State()]) -> AppState:
    return state


@commands.command()
async def close_folder(state: Annotated[AppState, State()]) -> None:
    state.folder = None
    state.tags_prefix = []
    state.items = []

class SaveArgs(_BaseModel):
    current: str
    tool: BrushTool | RectTool | SplitTool | TrimTool | ExpandTool | ViewTool | ConcatTool
    tags: list[str]


@commands.command()
async def save(state: Annotated[AppState, State()], body: SaveArgs) -> str | None:
    item, idx = where(state.items, lambda it: it.image_path == Path(body.current))
    
    result = None

    if body.tags != item.tags:
        item.tags = body.tags

        with open(item.caption_path, 'w') as f:
            f.write(', '.join(state.tags_prefix + item.tags))

    if body.tool:
        result = body.tool.run(state, idx)

    return result

@commands.command()
async def set_prefix(state: Annotated[AppState, State()], body: list[str]) -> None:
    if body == state.tags_prefix:
        return
    
    state.tags_prefix = body

    for it in state.items:
        with open(it.caption_path, 'w') as f:
            f.write(', '.join(state.tags_prefix + it.tags))

@commands.command()
async def delete_item(state: Annotated[AppState, State()], body: str) -> None:
    item, idx = where(state.items, lambda it: it.image_path == Path(body))
    
    item.caption_path.unlink()
    item.image_path.unlink()

    state.items.pop(idx)

    pref = get_common_prefix(map(lambda it: it.tags, state.items))

    if len(pref):
        for it in state.items:
            it.tags = it.tags[len(pref):]
        state.tags_prefix.extend(pref)


type BatchOperationPayload = (
    EscapeOperation | UnescapeOperation | AlignResolutionOperation |
    DeduplicateTagsOperation | ReplaceTagsOperation | RemoveTagsOperation |
    RemoveTransparencyOperation
)

@commands.command()
async def batch_operation(state: Annotated[AppState, State()], body: BatchOperationPayload) -> None:
    if state.folder is None:
        return
    
    body.run(state)

@commands.command()
async def on_drag(state: Annotated[AppState, State()], body: list[str]) -> str:
    paths = list(map(lambda it: Path(it), body))

    if len(paths) == 0:
        raise ValueError('Payload empty')

    if len(paths) == 1:
        path = paths[0]

        if path.is_dir():
            await open_folder(state, str(path))

            return 'Opened directory'
    
    if state.folder is None:
        raise ValueError('No open directory')
    
    for it in paths:
        target = copy(it, state.folder)

        caption_out = get_caption(target)
        caption_in = get_caption(it, False)

        if caption_in is not None:
            with open(caption_out, 'w') as out, open(caption_in, 'r') as f:
                out.write(f.read())

    return ''


@commands.command()
async def open_folder(state: Annotated[AppState, State()], body: str) -> None:
    p = Path(body)
    state.folder = p
    state.tags_prefix = []
    state.items = []

    for it in p.glob('**/*'):
        if it.suffix not in IMAGE_EXT:
            continue
        
        caption_path = get_caption(it)

        with open(caption_path) as f:
            caption = f.read()

        state.items.append(DatasetItem(
            caption_path=caption_path,
            image_path=it,
            tags=list(map(lambda it: it.strip(), caption.split(',')))
        ))

    state.tags_prefix = get_common_prefix(map(lambda it: it.tags, state.items))

    for it in state.items:
        it.tags = it.tags[len(state.tags_prefix):]


def main() -> int:
    with start_blocking_portal("asyncio") as portal:  # or `trio`
        if PYTAURI_GEN_TS:
            output_dir = Path(
                __file__).parent.parent.parent.parent / "src" / "client"
            json2ts_cmd = "yarn json2ts --format=false"

            portal.start_task_soon(
                lambda: commands.experimental_gen_ts_background(
                    output_dir, json2ts_cmd, cmd_alias=to_camel
                )
            )

        app = builder_factory().build(
            context=context_factory(),
            invoke_handler=commands.generate_handler(portal),
        )
        Manager.manage(app, AppState())

        exit_code = app.run_return()
        return exit_code
