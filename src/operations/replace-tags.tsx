import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Replace } from 'lucide-react';
import { BatchOperationContext, BatchOperationDefinition } from "./types";
import { batchOperation } from "@/client/apiClient";

interface ReplaceTagsOptionsProps {
  onConfirm: (options: ReplaceTagPayload) => void;
  onCancel: () => void;
  context: BatchOperationContext;
}

export interface ReplaceTagPayload {
  find: string;
  replace: string;
}

function ReplaceTagsOptions({ onConfirm, onCancel }: ReplaceTagsOptionsProps) {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Find Tag</Label>
          <Input 
            value={find} 
            onChange={e => setFind(e.target.value)} 
            placeholder="Tag to find..."
          />
        </div>
        
        <div className="space-y-2">
          <Label>Replace With</Label>
          <Input 
            value={replace} 
            onChange={e => setReplace(e.target.value)} 
            placeholder="Replacement tag (leave empty to delete)..."
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onConfirm({ find, replace })}>Execute</Button>
      </div>
    </div>
  );
}

export const ReplaceTagsOperation: BatchOperationDefinition<ReplaceTagPayload> = {
  id: 'replace_tags',
  label: 'Replace tags',
  icon: Replace,
  optionsComponent: ReplaceTagsOptions,
  execute: async (context, options) => {
    await batchOperation({
      id: 'replace_tags',
      find: options.find,
      replace: options.replace,
    });
    context.toast.success('Saved');
  }
};
