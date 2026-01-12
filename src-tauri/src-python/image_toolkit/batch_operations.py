from typing import Literal
from PIL import Image
from functional import seq
from re import sub, match as rmatch

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

class DeduplicateTagsOperation(Operation):
    id: Literal['deduplicate_tags']

    def run(self, state):
        prefix_tags = seq(state.caption_prefix.split(',')).map(lambda x: x.strip()).to_set()
        for it in state.items:
            tags = seq(it.caption_str.split(',')).map(lambda x: x.strip()).to_list()
            result = []
            for tag in tags:
                if tag not in result and tag not in prefix_tags:
                    result.append(tag)
            s = ', '.join(result)

            if s != it.caption_str:
                with open(it.caption, 'w') as f:
                    f.write(state.caption_prefix + s)
                it.caption_str = s

class ReplaceTagsOperation(Operation):
    id: Literal['replace_tags']
    find: str
    replace: str

    def run(self, state):
        for it in state.items:
            tags = seq(it.caption_str.split(',')).map(lambda x: x.strip()).to_list()
            result = []
            for tag in tags:
                if tag == self.find:
                    if len(self.replace) == 0:
                        continue
                    else:
                        result.append(self.replace)
                else:
                    result.append(tag)
            s = ', '.join(result)
            
            if s != it.caption_str:
                with open(it.caption, 'w') as f:
                    f.write(state.caption_prefix + s)
                it.caption_str = s
    
class RemoveTagsOperation(Operation):
    id: Literal['remove_tags']
    tags: list[str]

    def run(self, state):
        for it in state.items:
            tags = seq(it.caption_str.split(',')).map(lambda x: x.strip()).to_list()
            result = []

            for tag in tags:
                rm = False

                for pattern in self.tags:
                    if pattern.startswith('^') and pattern.endswith('$'):
                        if rmatch(pattern, tag):
                            rm = True
                            break
                    else:
                        if pattern == tag:
                            rm = True
                            break
                if not rm:
                    result.append(tag)

            s = ', '.join(result)
            if s != it.caption_str:
                with open(it.caption, 'w') as f:
                    f.write(state.caption_prefix + s)
                it.caption_str = s


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

class RemoveTransparencyOperation(Operation):
    id: Literal['remove_transparency']
    color: str

    def run(self, state):
        for it in state.items:
            img = Image.open(it.image)
            
            if not img.has_transparency_data:
                continue

            result = Image.new(img.mode, img.size, self.color)

            result.alpha_composite(img)

            result.save(it.image)