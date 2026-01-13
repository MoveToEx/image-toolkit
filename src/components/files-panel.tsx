import { Plus, Trash2, X } from "lucide-react"
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
import { Label } from "./ui/label"
import { Input } from "./ui/input"

export default function FilesPanel({
  items,
  selected,
  prefix,
  prefixDisabled,
  onSelect,
  onDelete,
  onPrefixChange,
}: {
  items: string[],
  selected: string | null,
  prefix: string[] | undefined,
  prefixDisabled: boolean,
  onSelect: (val: string) => void,
  onDelete: (val: string) => void,
  onPrefixChange: (val: string[]) => void,
}) {
  const [newPrefix, setNewPrefix] = useState("");

  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const handleDeletePrefix = (index: number) => {
    if (!prefix) return;

    onPrefixChange(prefix.filter((_, i) => i !== index));
  }
  const handlePrefixKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddPrefix();
    }
  }

  const handleAddPrefix = () => {
    if (prefix === undefined) return;
    if (!newPrefix.trim()) return;
    if (prefix.indexOf(newPrefix.trim()) != -1) return;

    onPrefixChange([...prefix, newPrefix.trim()]);
    setNewPrefix("");
  }

  return (
    <>
      <ScrollArea className='h-full w-full p-2'>
        <Label className="text-base font-semibold">Prefix</Label>
        <div className='px-2'>
          <div className='my-2'>
            <div className="flex flex-wrap gap-2">
              {prefix?.length === 0 && (
                <span className="text-sm text-muted-foreground italic p-1">No prefix set</span>
              )}
              {prefix?.map((p, i) => (
                <div key={i} className="flex items-center gap-1 bg-background border rounded-md pl-2 pr-1 py-1 text-sm shadow-sm group hover:border-primary/50 transition-colors">
                  <span>{p}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleDeletePrefix(i)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              disabled={prefixDisabled || prefix === undefined}
              value={newPrefix}
              onChange={(e) => setNewPrefix(e.target.value)}
              onKeyDown={handlePrefixKeyDown}
              placeholder="Add prefix..."
              className="flex-1"
            />
            <Button size="icon" disabled={prefixDisabled || !newPrefix.trim() || prefix === undefined} onClick={handleAddPrefix}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <Label className="text-base font-semibold mt-4">Files</Label>

        <div className='px-2'>

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
        </div>
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