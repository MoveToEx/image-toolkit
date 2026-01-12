import { CopyMinus } from "lucide-react";
import { BatchOperationDefinition } from "./types";
import { batchOperation } from "@/client/apiClient";

export const DeduplicateTagsOperation: BatchOperationDefinition<void> = {
  id: 'deduplicate_tags',
  label: 'Deduplicate tags',
  icon: CopyMinus,
  execute: async (context) => {
    await batchOperation({
      id: 'deduplicate_tags'
    });
    context.toast.success('Saved');
  }
};
