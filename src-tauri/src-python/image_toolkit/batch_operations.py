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
        for i in range(len(state.tags_prefix)):
            state.tags_prefix[i] = sub(r'(?<!\\)\(', r'\(', state.tags_prefix[i])
            state.tags_prefix[i] = sub(r'(?<!\\)\)', r'\)', state.tags_prefix[i])

        for it in state.items:
            for i in range(len(it.tags)):
                it.tags[i] = sub(r'(?<!\\)\(', r'\(', it.tags[i])
                it.tags[i] = sub(r'(?<!\\)\)', r'\)', it.tags[i])

            with open(it.caption_path, 'w') as f:
                f.write(', '.join(state.tags_prefix + it.tags))


class UnescapeOperation(Operation):
    id: Literal['unescape_parentheses']

    def run(self, state):
        for i in range(len(state.tags_prefix)):
            state.tags_prefix[i] = sub(r'\\\(', r'(', state.tags_prefix[i])
            state.tags_prefix[i] = sub(r'\\\)', r')', state.tags_prefix[i])

        for it in state.items:
            for i in range(len(it.tags)):
                it.tags[i] = sub(r'\\\(', r'(', it.tags[i])
                it.tags[i] = sub(r'\\\)', r')', it.tags[i])
            
            with open(it.caption_path, 'w') as f:
                f.write(', '.join(state.tags_prefix + it.tags))

class DeduplicateTagsOperation(Operation):
    id: Literal['deduplicate_tags']

    def run(self, state):
        prefix_tags = set(state.tags_prefix)
        for it in state.items:
            tags = []
            for tag in it.tags:
                if tag not in tags and tag not in prefix_tags:
                    tags.append(tag)

            if tags != it.tags:
                with open(it.caption_path, 'w') as f:
                    f.write(', '.join(state.tags_prefix + tags))
                it.tags = tags

class ReplaceTagsOperation(Operation):
    id: Literal['replace_tags']
    find: str
    replace: str

    def run(self, state):
        for it in state.items:
            result = []
            for tag in it.tags:
                if tag == self.find:
                    if len(self.replace) == 0:
                        continue
                    else:
                        result.append(self.replace)
                else:
                    result.append(tag)
            
            if result != it.tags:
                with open(it.caption_path, 'w') as f:
                    f.write(', '.join(state.tags_prefix + result))
                it.tags = result
    
class RemoveTagsOperation(Operation):
    id: Literal['remove_tags']
    tags: list[str]

    def run(self, state):
        for it in state.items:
            result = []

            for tag in it.tags:
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

            if result != it.tags:
                with open(it.caption_path, 'w') as f:
                    f.write(', '.join(state.tags_prefix + result))
                it.tags = result


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
            img = Image.open(it.image_path)
            width, height = img.size
            ratio = min(self.width / width, self.height / height)
            
            img = img.resize((int(width * ratio), int(height * ratio)), Image.Resampling.LANCZOS)
            width, height = img.size

            tags = it.tags.copy()

            if abs(width - self.width) > abs(height - self.height) and self.box_tag:
                if 'pillarboxed' not in tags:
                    tags.append('pillarboxed')
            if abs(height - self.height) > abs(width - self.width) and self.box_tag:
                if 'letterboxed' not in tags:
                    tags.append('letterboxed')

            if tags != it.tags:
                with open(it.caption_path, 'w') as f:
                    f.write(', '.join(state.tags_prefix + it.tags))
            
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
            result.save(it.image_path)

class RemoveTransparencyOperation(Operation):
    id: Literal['remove_transparency']
    color: str

    def run(self, state):
        for it in state.items:
            img = Image.open(it.image_path)
            
            if not img.has_transparency_data:
                continue

            result = Image.new(img.mode, img.size, self.color)

            result.alpha_composite(img)

            result.save(it.image_path)