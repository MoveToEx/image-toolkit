from anyio.from_thread import start_blocking_portal
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from pytauri import (
    Commands,
    builder_factory,
    context_factory,
    Manager,
    State
)
from tkinter import filedialog
from pathlib import Path
from os import getenv
from typing import Annotated

from image_toolkit.utils import get_common_prefix, where
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

    state.items.pop(idx)


@commands.command()
async def select_folder(state: Annotated[AppState, State()]) -> bool:
    p = filedialog.askdirectory()

    if len(p) == 0:
        return False

    p = Path(p)
    state.folder = p
    state.caption_prefix = ''
    state.items = []

    for it in p.glob('**/*'):
        if it.suffix not in IMAGE_EXT:
            continue
        caption_path = it.parent / (it.stem + '.txt')

        if not caption_path.exists():
            caption_path = it.parent / (it.name + '.txt')
        if not caption_path.exists():
            caption_path = it.parent / it.stem
        if not caption_path.exists():
            caption_path = it.parent / (it.stem + '.txt')
            caption_path.touch()

        with open(caption_path) as f:
            caption = f.read()

        state.items.append(DatasetItem(
            caption=caption_path,
            caption_str=caption,
            image=it,
        ))

    state.caption_prefix = get_common_prefix(
        map(lambda it: it.caption_str, state.items))

    for it in state.items:
        it.caption_str = it.caption_str.removeprefix(state.caption_prefix)

    return True


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
