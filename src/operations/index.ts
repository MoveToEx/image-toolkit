import { BatchOperationDefinition } from "./types";
import { EscapeParenthesesOperation } from "./escape-parentheses";
import { UnescapeParenthesesOperation } from "./unescape-parentheses";
import { ResolutionAlignmentOperation } from "./resolution-alignment";
import { DeduplicateTagsOperation } from "./dedup-tags";
import { ReplaceTagsOperation } from "./replace-tags";
import { RemoveTagsOperation } from "./remove-tags";
import { RemoveTransparencyOperation } from "./remove-transparency";

export type { BatchOperationDefinition, BatchOperationContext } from "./types";

export const BATCH_OPERATIONS: BatchOperationDefinition<any>[] = [
  EscapeParenthesesOperation,
  UnescapeParenthesesOperation,
  DeduplicateTagsOperation,
  ResolutionAlignmentOperation,
  RemoveTransparencyOperation,
  ReplaceTagsOperation,
  RemoveTagsOperation,
];
