import { useEffect, useState, useCallback } from "react";
import { getState, openFolder } from "@/client/apiClient";
import { open } from '@tauri-apps/plugin-dialog';

export type AppState = Awaited<ReturnType<typeof getState>>;

export function useAppState() {
  const [appState, setAppState] = useState<AppState>({});
  const [loading, setLoading] = useState(true);

  // Fetch initial state
  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await getState();
    setAppState(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, []);

  const select = useCallback(async () => {
    const file = await open({
      multiple: false,
      directory: true
    });
    if (file) {
      await openFolder(file);
    }

    await refresh();
  }, []);

  return {
    appState,
    loading,
    refresh,
    select,
  };
}
