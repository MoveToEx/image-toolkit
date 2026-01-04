import { useEffect, useState, useCallback } from "react";
import { getState, selectFolder } from "@/client/apiClient";

type AppState = Awaited<ReturnType<typeof getState>>;

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
    await selectFolder();

    await refresh();
  }, []);

  return {
    appState,
    loading,
    refresh,
    select,
  };
}
