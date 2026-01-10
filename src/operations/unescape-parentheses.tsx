import { Parentheses } from "lucide-react";
import { BatchOperationDefinition } from "./types";
import { batchOperation } from "@/client/apiClient";

export const UnescapeParenthesesOperation: BatchOperationDefinition = {
  id: 'unescape_parentheses',
  label: 'Unescape brackets',
  icon: Parentheses,
  execute: async (context) => {
    await batchOperation({
      id: 'unescape_parentheses'
    });
    context.toast.success('Saved');
  }
};
