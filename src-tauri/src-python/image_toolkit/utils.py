from typing import Iterable, Sequence, Callable, Literal, overload
from pathlib import Path

def pairwise_common_prefix(a: str, b: str) -> str:
    result = ''
    for i in range(min(len(a), len(b))):
        if a[i] == b[i]:
            result += a[i]
        else:
            break
    return result

def get_common_prefix(s: Iterable[str]) -> str:
    first = True
    result = ''

    for it in s:
        if first:
            result = it
            first = False
        else:
            result = pairwise_common_prefix(result, it)

    return result

@overload
def get_caption(file: Path, create: Literal[True]) -> Path: ...

@overload
def get_caption(file: Path, create: Literal[False]) -> (Path | None): ...

@overload
def get_caption(file: Path) -> Path: ...


def get_caption(file: Path, create: bool = True):
    result = file.parent / (file.stem + '.txt')

    if not result.exists():
        result = file.parent / (file.name + '.txt')
    if not result.exists():
        result = file.parent / file.stem
    if not result.exists():
        if not create:
            return None
        
        result = file.parent / (file.stem + '.txt')
        result.touch()

    return result

def copy(source: Path, dest: Path):
    target = dest / source.name
    i = 1

    while target.exists():
        target = dest / (source.stem + f'_{i}' + source.suffix)
        i += 1

    with open(target, 'wb') as out, open(source, 'rb') as f:
        out.write(f.read())
    
    return target

def where[T](seq: Sequence[T], pred: Callable[[T], bool]):
    for i, it in enumerate(seq):
        if pred(it):
            return it, i
        
    raise RuntimeError('Value not found')