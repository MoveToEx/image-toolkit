from anyio.from_thread import start_blocking_portal
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from pytauri import (
    Commands,
    builder_factory,
    context_factory,
    App,
    AppHandle,
    Manager,
    State
)
from tkinter import filedialog
from pathlib import Path
from os import getenv
from os.path import splitext
from pytauri.webview import WebviewWindow
from typing import Annotated, Literal
from PIL import Image, ImageDraw

from image_toolkit.utils import get_common_prefix

PYTAURI_GEN_TS = getenv("PYTAURI_GEN_TS") != "0"

commands: Commands = Commands(experimental_gen_ts=PYTAURI_GEN_TS)


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


IMAGE_EXT = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}


@commands.command()
async def get_state(state: Annotated[AppState, State()]) -> AppState:
    return state


@commands.command()
async def close_folder(state: Annotated[AppState, State()]) -> None:
    state.folder = None
    state.caption_prefix = ''
    state.items = []


class Point(_BaseModel):
    x: float
    y: float


class BrushState(_BaseModel):
    color: str
    width: int
    points: list[Point]


class BrushTool(_BaseModel):
    id: Literal['brush']
    drawing: list[BrushState]


class RectState(_BaseModel):
    color: str
    start: Point
    end: Point


class RectTool(_BaseModel):
    id: Literal['rect']
    drawing: list[RectState]


class SplitTool(_BaseModel):
    id: Literal['split']
    mode: Literal['cross', 'horizontal', 'vertical']
    point: Point

class TrimTool(_BaseModel):
    id: Literal['trim']
    top: int
    bottom: int
    left: int
    right: int

class ExpandTool(_BaseModel):
    id: Literal['expand']
    color: str
    top: int
    bottom: int
    left: int
    right: int

class SaveArgs(_BaseModel):
    current: str
    tool: BrushTool | RectTool | SplitTool | TrimTool | ExpandTool
    caption: str
    caption_prefix: str


@commands.command()
async def save(state: Annotated[AppState, State()], body: SaveArgs) -> str | None:
    item = None
    idx = 0
    for i, it in enumerate(state.items):
        if it.image == Path(body.current):
            item = it
            idx = i
            break

    if item is None:
        return
    
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
        img = Image.open(item.image)
        width, height = img.size

        if body.tool.id == 'brush':
            draw = ImageDraw.ImageDraw(img)
            for it in body.tool.drawing:
                pts = []
                for pt in it.points:
                    pts.append(pt.x)
                    pts.append(pt.y)
                draw.line(pts, it.color, it.width)
            img.save(item.image, quality=100)
        elif body.tool.id == 'rect':
            draw = ImageDraw.ImageDraw(img)
            for it in body.tool.drawing:
                l, t, r, b = min(it.start.x, it.end.x), min(it.start.y, it.end.y), max(it.start.x, it.end.x), max(it.start.y, it.end.y)
                l, t, r, b = max(0, l), max(0, t), min(width, r), min(height, b)
                draw.rectangle((l, t, r, b), it.color, width=0)
            img.save(item.image, quality=100)
        elif body.tool.id == 'split':
            cropped = []
            pt = body.tool.point
            if body.tool.mode == 'cross':
                cropped = [
                    img.crop((0, 0, pt.x, pt.y)),
                    img.crop((pt.x + 1, 0, width, pt.y)),
                    img.crop((0, pt.y + 1, pt.x, height)),
                    img.crop((pt.x + 1, pt.y + 1, width, height))
                ]
            elif body.tool.mode == 'horizontal':
                cropped = [
                    img.crop((0, 0, pt.x, height)),
                    img.crop((pt.x + 1, 0, width, height))
                ]
            elif body.tool.mode == 'vertical':
                cropped = [
                    img.crop((0, 0, width, pt.y)),
                    img.crop((0, pt.y + 1, width, height))
                ]

            stem, ext = splitext(item.image)
            for i, it in enumerate(cropped):
                fn = item.image.parent / (stem + f'_{i + 1}' + ext)
                it.save(fn, quality=100)
                with open(item.image.parent / (stem + f'_{i + 1}' + '.txt'), 'w') as f:
                    f.write(state.caption_prefix + item.caption_str)

                state.items.insert(idx + 1 + i, DatasetItem(
                    caption=item.image.parent / (stem + f'_{i + 1}' + '.txt'),
                    caption_str = item.caption_str,
                    image=item.image.parent / (stem + f'_{i + 1}' + ext)
                ))
            
            item.image.unlink()
            item.caption.unlink()
            state.items.pop(idx)
            result = stem + '_1' + ext
        elif body.tool.id == 'trim':
            img.crop((body.tool.left, body.tool.top, width - body.tool.right, height - body.tool.bottom)).save(item.image, quality=100)
        elif body.tool.id == 'expand':
            expanded = Image.new(img.mode, (
                width + body.tool.left + body.tool.right,
                height + body.tool.top + body.tool.bottom
            ), body.tool.color)
            expanded.paste(img, (body.tool.left, body.tool.top))
            expanded.save(item.image, quality=100)

    return result
            




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
