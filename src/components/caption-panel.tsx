import { Plus, X } from "lucide-react"
import { useState } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { ScrollArea } from "./ui/scroll-area"

export default function CaptionPanel({
  tags,
  onTagsChange,
}: {
  tags: string[] | undefined,
  onTagsChange: (val: string[]) => void,
}) {
  const [newTags, setNewTags] = useState("")


  const handleAddTags = () => {
    if (!newTags.trim()) return
    const items = newTags
      .split(/[,\n]+/)
      .map(t => t.trim())
      .filter(t => Boolean(t) && tags?.indexOf(t) == -1)
    const currentTags = tags || []
    onTagsChange([...currentTags, ...items])
    setNewTags("")
  }

  const handleDeleteTag = (index: number) => {
    if (!tags) return
    onTagsChange(tags.filter((_, i) => i !== index))
  }

  const handleTagsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAddTags()
    }
  }

  return (
    <ScrollArea className='w-full h-full'>
      <div className="flex flex-col p-4 gap-6">
        {/* Tags Section */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Tags</Label>

          <div>
            <div className="flex flex-wrap gap-2">
              {(!tags || tags.length === 0) && (
                <span className="text-sm text-muted-foreground italic p-1">No tags</span>
              )}
              {tags?.map((tag, i) => (
                <div key={i} className="flex items-center gap-1 bg-background border rounded-md pl-2 pr-1 py-1 text-sm shadow-sm group hover:border-primary/50 transition-colors">
                  <span className="max-w-37.5 truncate" title={tag}>{tag}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleDeleteTag(i)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-row gap-2">
            <Input 
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              onKeyDown={handleTagsKeyDown}
              placeholder="Add tags (separate by comma)..."
              className="resize-none"
            />
            <Button onClick={handleAddTags} disabled={!newTags.trim()}>
              <Plus />
            </Button>
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}