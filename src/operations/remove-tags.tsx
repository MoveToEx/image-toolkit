import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eraser } from 'lucide-react';
import { BatchOperationContext, BatchOperationDefinition } from "./types";
import { batchOperation } from "@/client/apiClient";

interface RemoveTagsOptionsProps {
  onConfirm: (options: RemoveTagsPayload) => void;
  onCancel: () => void;
  context: BatchOperationContext;
}

export interface RemoveTagsPayload {
  tags: string[];
}

function RemoveTagsOptions({ onConfirm, onCancel }: RemoveTagsOptionsProps) {
  const [tagsStr, setTagsStr] = useState('');

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Tags to Remove</Label>
          <Input 
            value={tagsStr} 
            onChange={e => setTagsStr(e.target.value)} 
            placeholder="tag1, tag2, ^regex$"
          />
          <p className="text-sm text-muted-foreground">
            Separate multiple tags with commas.
          </p>
          <p className="text-sm text-muted-foreground">
            Wrap regular expressions with <kbd>^</kbd> and <kbd>$</kbd>
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => {
            const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0);
            onConfirm({ tags });
        }}>Execute</Button>
      </div>
    </div>
  );
}

export const RemoveTagsOperation: BatchOperationDefinition<RemoveTagsPayload> = {
  id: 'remove_tags',
  label: 'Remove tags',
  icon: Eraser,
  optionsComponent: RemoveTagsOptions,
  execute: async (context, options) => {
    await batchOperation({
      id: 'remove_tags',
      tags: options.tags,
    });
    context.toast.success('Batch operation completed');
  }
};
