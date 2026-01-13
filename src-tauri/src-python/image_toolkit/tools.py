from typing import Literal
from pathlib import Path
from os.path import splitext
from PIL import Image, ImageDraw
from functional import seq

from image_toolkit.types import _BaseModel, DatasetItem, AppState
from image_toolkit.utils import where

class Tool(_BaseModel):
    def run(self, state: AppState, idx: int) -> str | None:
        raise NotImplementedError()


class Point(_BaseModel):
    x: float
    y: float


class BrushState(_BaseModel):
    color: str
    width: int
    points: list[Point]


class ViewTool(Tool):
    id: Literal['view']

    def run(self, state, idx):
        pass


class BrushTool(Tool):
    id: Literal['brush']
    drawing: list[BrushState]

    def run(self, state, idx):
        item = state.items[idx]
        img = Image.open(item.image_path)
        draw = ImageDraw.ImageDraw(img)
        for it in self.drawing:
            pts = []
            for pt in it.points:
                pts.append(pt.x)
                pts.append(pt.y)
            draw.line(pts, it.color, it.width)
        img.save(item.image_path, quality=100)
    
class RectState(_BaseModel):
    color: str
    start: Point
    end: Point


class RectTool(Tool):
    id: Literal['rect']
    drawing: list[RectState]

    def run(self, state, idx):
        item = state.items[idx]
        img = Image.open(item.image_path)
        width, height = img.size

        draw = ImageDraw.ImageDraw(img)
        for it in self.drawing:
            l, t, r, b = min(it.start.x, it.end.x), min(it.start.y, it.end.y), max(it.start.x, it.end.x), max(it.start.y, it.end.y)
            l, t, r, b = max(0, l), max(0, t), min(width, r), min(height, b)
            draw.rectangle((l, t, r, b), it.color, width=0)
        img.save(item.image_path, quality=100)


class SplitTool(Tool):
    id: Literal['split']
    mode: Literal['cross', 'horizontal', 'vertical']
    point: Point

    def run(self, state, idx):
        item = state.items[idx]
        img = Image.open(item.image_path)
        width, height = img.size

        cropped = []
        pt = self.point
        if self.mode == 'cross':
            cropped = [
                img.crop((0, 0, pt.x, pt.y)),
                img.crop((pt.x + 1, 0, width, pt.y)),
                img.crop((0, pt.y + 1, pt.x, height)),
                img.crop((pt.x + 1, pt.y + 1, width, height))
            ]
        elif self.mode == 'horizontal':
            cropped = [
                img.crop((0, 0, pt.x, height)),
                img.crop((pt.x + 1, 0, width, height))
            ]
        elif self.mode == 'vertical':
            cropped = [
                img.crop((0, 0, width, pt.y)),
                img.crop((0, pt.y + 1, width, height))
            ]

        stem, ext = splitext(item.image_path)
        for i, it in enumerate(cropped):
            fn = item.image_path.parent / (stem + f'_{i + 1}' + ext)
            it.save(fn, quality=100)
            with open(item.image_path.parent / (stem + f'_{i + 1}' + '.txt'), 'w') as f:
                f.write(', '.join(state.tags_prefix + item.tags))

            state.items.insert(idx + 1 + i, DatasetItem(
                caption_path=item.image_path.parent / (stem + f'_{i + 1}' + '.txt'),
                tags = item.tags.copy(),
                image_path=item.image_path.parent / (stem + f'_{i + 1}' + ext)
            ))
        
        item.image_path.unlink()
        item.caption_path.unlink()
        state.items.pop(idx)

        return stem + '_1' + ext

class TrimTool(Tool):
    id: Literal['trim']
    top: int
    bottom: int
    left: int
    right: int

    def run(self, state, idx):
        item = state.items[idx]
        img = Image.open(item.image_path)
        width, height = img.size

        img.crop((self.left, self.top, width - self.right, height - self.bottom)).save(item.image_path, quality=100)

class ExpandTool(Tool):
    id: Literal['expand']
    color: str
    top: int
    bottom: int
    left: int
    right: int

    def run(self, state, idx):
        item = state.items[idx]
        img = Image.open(item.image_path)
        width, height = img.size

        expanded = Image.new(img.mode, (
            width + self.left + self.right,
            height + self.top + self.bottom
        ), self.color)
        expanded.paste(img, (self.left, self.top))
        expanded.save(item.image_path, quality=100)

class ConcatTool(Tool):
    id: Literal['concat']
    mode: Literal['horizontal', 'vertical']
    image: Path
    offset: int
    color: str

    def run(self, state, idx):
        item = state.items[idx]
        img = Image.open(item.image_path)
        width, height = img.size

        fn = Path(self.image)
        other, other_idx = where(state.items, lambda it: it.image_path == fn)
        other_img = Image.open(other.image_path)
        other_width, other_height = other_img.size
        out = None
        
        if self.mode == 'horizontal':
            out = Image.new(img.mode, (other_width + width, max(other_height, height)), self.color)
        elif self.mode == 'vertical':
            out = Image.new(img.mode, (max(other_width, width), other_height + height), self.color)
        else:
            raise RuntimeError('Unknown concat mode ' + self.mode)

        if self.mode == 'horizontal':
            if height > other_height:
                out.paste(img, (0, 0))
                out.paste(other_img, (width, self.offset))
            elif height == other_height:
                out.paste(img, (0, 0))
                out.paste(other_img, (width, 0))
            else:   # height < other_height
                out.paste(img, (0, self.offset))
                out.paste(other_img, (width, 0))
        elif self.mode == 'vertical':
            if width > other_width:
                out.paste(img, (0, 0))
                out.paste(other_img, (self.offset, height))
            elif width == other_width:
                out.paste(img, (0, 0))
                out.paste(other_img, (0, height))
            else:   # width < other_width
                out.paste(img, (self.offset, 0))
                out.paste(other_img, (0, height))
        
        out.save(item.image_path)
        other.caption_path.unlink()
        other.image_path.unlink()

        with open(item.caption_path, 'w') as f:
            for it in other.tags:
                if it not in item.tags:
                    item.tags.append(it)

            f.write(', '.join(state.tags_prefix + item.tags))
        
        state.items.pop(other_idx)
