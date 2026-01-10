import { LucideIcon } from "lucide-react";
import { AppState } from "@/lib/hooks";
import { toast } from "sonner";
import React from "react";
import type { DatasetItem } from "@/client/_apiTypes.d.ts";

export interface BatchOperationContext {
  appState: AppState;
  selectedItem: DatasetItem | undefined;
  // UI helpers
  toast: typeof toast;
}

export interface BatchOperationDefinition {
  id: string;
  label: string;
  icon?: LucideIcon;
  description?: string;
  
  // If defined, this component will be shown in a dialog.
  // When the user confirms, the execute method is called with the result.
  optionsComponent?: React.ComponentType<{
     onConfirm: (options: any) => void;
     onCancel: () => void;
     context: BatchOperationContext;
  }>;
  
  // existing operations (escape/unescape) handle their own loading state / wrapper if needed, 
  // but typically the runner (App.tsx) handles the top loading state.
  execute: (context: BatchOperationContext, options?: any) => Promise<void>;
}
