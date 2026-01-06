import { Trash2 } from "lucide-react"
import { Button } from "./ui/button"
import { ScrollArea } from "./ui/scroll-area"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog"
import { useState } from "react"

export default function FilesPanel({
  items,
  selected,
  onSelect,
  onDelete
}: {
  items: string[],
  selected: string | null,
  onSelect: (val: string) => void,
  onDelete: (val: string) => void
}) {
  const [itemToDelete, setItemToDelete] = useState<string | null>(null)

  return (
    <>
      <ScrollArea className='h-full w-full p-2'>
        {items.map(item => (
          <div key={item} className="flex flex-row items-center group">
            <Button
              variant='ghost'
              className={`flex-1 justify-start h-8 px-2 ${selected === item ? 'bg-accent' : ''}`}
              onClick={() => onSelect(item)}
            >
              <span className={`truncate ${selected === item ? 'font-bold' : ''}`}>
                {item.slice(item.lastIndexOf('\\') + 1)}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation()
                setItemToDelete(item)
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </ScrollArea>

      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the file.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant='destructive'
                onClick={() => {
                  if (itemToDelete) {
                    onDelete(itemToDelete)
                    setItemToDelete(null)
                  }
                }}>
                Delete
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}