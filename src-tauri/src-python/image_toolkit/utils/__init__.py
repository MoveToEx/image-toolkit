from typing import Iterable, Sequence, Callable

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

def where[T](seq: Sequence[T], pred: Callable[[T], bool]):
    for i, it in enumerate(seq):
        if pred(it):
            return it, i
        
    raise RuntimeError('Value not found')