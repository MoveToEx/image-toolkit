import { SquareSlash } from "lucide-react";
import { BatchOperationDefinition } from "./types";
import { batchOperation } from "@/client/apiClient";

export const EscapeParenthesesOperation: BatchOperationDefinition = {
  id: 'escape_parentheses',
  label: 'Escape brackets',
  icon: SquareSlash,
  execute: async (context) => {
    await batchOperation({
      id: 'escape_parentheses'
    });
    context.toast.success('Saved');
  }
};
