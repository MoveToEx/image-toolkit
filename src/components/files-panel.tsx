import { Button } from "./ui/button"
import { ScrollArea } from "./ui/scroll-area"

export default function FilesPanel({
  items,
  selected,
  onSelect,
}: {
  items: string[],
  selected: string | null,
  onSelect: (val: string) => void,
}) {
  return (
    <ScrollArea className='h-full m-2'>
      {items.map(item => (
        <Button asChild key={item} variant='ghost' className='flex' onClick={() => onSelect(item)}>
          <div className='flex-1 flex flex-row justify-start items-center'>
            <span className={selected === item ? 'font-bold' : ''}>
              {item.slice(item.lastIndexOf('\\') + 1)}
            </span>
          </div>
        </Button>
      ))}
    </ScrollArea>
  )
}