from typing import Literal
from PIL import Image
from functional import seq
from re import sub

from image_toolkit.types import _BaseModel, AppState
from image_toolkit.utils import where


class Operation(_BaseModel):
    def run(self, state: AppState) -> str | None:
        raise NotImplementedError()


class EscapeOperation(Operation):
    id: Literal['escape_parentheses']

    def run(self, state):
        state.caption_prefix = sub(r'(?<!\\)\(', r'\(', state.caption_prefix)
        state.caption_prefix = sub(r'(?<!\\)\)', r'\)', state.caption_prefix)
        for it in state.items:
            it.caption_str = sub(r'(?<!\\)\(', r'\(', it.caption_str)
            it.caption_str = sub(r'(?<!\\)\)', r'\)', it.caption_str)
            with open(it.caption, 'w') as f:
                f.write(state.caption_prefix + it.caption_str)


class UnescapeOperation(Operation):
    id: Literal['unescape_parentheses']

    def run(self, state):
        state.caption_prefix = sub(r'\\\(', r'(', state.caption_prefix)
        state.caption_prefix = sub(r'\\\)', r')', state.caption_prefix)
        for it in state.items:
            it.caption_str = sub(r'\\\(', r'(', it.caption_str)
            it.caption_str = sub(r'\\\)', r')', it.caption_str)
            with open(it.caption, 'w') as f:
                f.write(state.caption_prefix + it.caption_str)


class AlignResolutionOperation(Operation):
    id: Literal['align_resolution']
    width: int
    height: int
    color: str
    box_tag: bool
    position: Literal['top-left', 'top-center', 'top-right', 'center-left',
                      'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right']
    
    def run(self, state):
        bg = Image.new('RGB', (self.width, self.height), self.color)

        for it in state.items:
            result = bg.copy()
            img = Image.open(it.image)
            width, height = img.size
            ratio = min(self.width / width, self.height / height)
            
            img = img.resize((int(width * ratio), int(height * ratio)), Image.Resampling.LANCZOS)
            width, height = img.size

            tags = seq((state.caption_prefix + it.caption_str).split(',')).map(lambda i: i.strip()).to_list()
            modified = False

            if abs(width - self.width) > abs(height - self.height) and self.box_tag:
                if 'pillarboxed' not in tags:
                    it.caption_str = ', '.join(tags) + ', pillarboxed'
                    modified = True
            if abs(height - self.height) > abs(width - self.width) and self.box_tag:
                if 'letterboxed' not in tags:
                    it.caption_str = ', '.join(tags) + ', letterboxed'
                    modified = True

            if modified:
                with open(it.caption, 'w') as f:
                    f.write(it.caption_str)
            
            left, top = 0, 0

            if self.position.startswith('top-'):
                top = 0
            elif self.position.startswith('center-'):
                top = (self.height - height) // 2
            elif self.position.startswith('bottom-'):
                top = self.height - height
            
            if self.position.endswith('-left'):
                left = 0
            elif self.position.endswith('-center'):
                left = (self.width - width) // 2
            elif self.position.endswith('-right'):
                left = (self.width - width)

            if self.position == 'center':
                top, left = (self.height - height) // 2, (self.width - width) // 2

            result.paste(img, (left, top))
            result.save(it.image)




