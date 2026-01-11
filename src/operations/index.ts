import { BatchOperationDefinition } from "./types";
import { EscapeParenthesesOperation } from "./escape-parentheses";
import { UnescapeParenthesesOperation } from "./unescape-parentheses";
import { ResolutionAlignmentOperation } from "./resolution-alignment";

export type { BatchOperationDefinition, BatchOperationContext } from "./types";

export const BATCH_OPERATIONS: BatchOperationDefinition<any>[] = [
  EscapeParenthesesOperation,
  UnescapeParenthesesOperation,
  ResolutionAlignmentOperation
];
