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
from typing import Annotated, Literal
from re import sub

from image_toolkit.utils import get_common_prefix, where, get_caption, copy
from image_toolkit.types import _BaseModel, AppState, DatasetItem
from image_toolkit.tools import (
    BrushTool, ConcatTool, ExpandTool, RectTool, SplitTool, TrimTool, ViewTool
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
    state.caption_prefix = ''
    state.items = []

class SaveArgs(_BaseModel):
    current: str
    tool: BrushTool | RectTool | SplitTool | TrimTool | ExpandTool | ViewTool | ConcatTool
    caption: str
    caption_prefix: str


@commands.command()
async def save(state: Annotated[AppState, State()], body: SaveArgs) -> str | None:
    item, idx = where(state.items, lambda it: it.image == Path(body.current))
    
    result = None

    if body.caption_prefix != state.caption_prefix:
        state.caption_prefix = body.caption_prefix

        for it in state.items:
            with open(it.caption, 'w') as f:
                f.write(state.caption_prefix + it.caption_str)

    if body.caption != item.caption_str:
        item.caption_str = body.caption

        with open(item.caption, 'w') as f:
            f.write(state.caption_prefix + body.caption)

    if body.tool:
        result = body.tool.run(state, idx)

    return result

@commands.command()
async def delete_item(state: Annotated[AppState, State()], body: str) -> None:
    item, idx = where(state.items, lambda it: it.image == Path(body))
    
    item.caption.unlink()
    item.image.unlink()

    state.caption_prefix = get_common_prefix(map(lambda it: it.caption_str, state.items))

    state.items.pop(idx)

class BatchOperationPayload(_BaseModel):
    op: Literal['escape_parentheses', 'unescape_parentheses']

@commands.command()
async def batch_operation(state: Annotated[AppState, State()], body: BatchOperationPayload) -> None:
    if body.op == 'escape_parentheses':
        state.caption_prefix = sub(r'(?<!\\)\(', r'\(', state.caption_prefix)
        state.caption_prefix = sub(r'(?<!\\)\)', r'\)', state.caption_prefix)
        for it in state.items:
            it.caption_str = sub(r'(?<!\\)\(', r'\(', it.caption_str)
            it.caption_str = sub(r'(?<!\\)\)', r'\)', it.caption_str)
            with open(it.caption, 'w') as f:
                f.write(state.caption_prefix + it.caption_str)

    elif body.op == 'unescape_parentheses':
        state.caption_prefix = sub(r'\\\(', r'(', state.caption_prefix)
        state.caption_prefix = sub(r'\\\)', r')', state.caption_prefix)
        for it in state.items:
            it.caption_str = sub(r'\\\(', r'(', it.caption_str)
            it.caption_str = sub(r'\\\)', r')', it.caption_str)
            with open(it.caption, 'w') as f:
                f.write(state.caption_prefix + it.caption_str)

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
    state.caption_prefix = ''
    state.items = []

    for it in p.glob('**/*'):
        if it.suffix not in IMAGE_EXT:
            continue
        
        caption_path = get_caption(it)

        with open(caption_path) as f:
            caption = f.read()

        state.items.append(DatasetItem(
            caption=caption_path,
            caption_str=caption,
            image=it,
        ))

    state.caption_prefix = get_common_prefix(map(lambda it: it.caption_str, state.items))

    for it in state.items:
        it.caption_str = it.caption_str.removeprefix(state.caption_prefix)


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
