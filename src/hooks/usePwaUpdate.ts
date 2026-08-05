import { useEffect, useState } from "react";
import { registerSW } from "virtual:pwa-register";

export function usePwaUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateSW, setUpdateSW] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const update = registerSW({
      onNeedRefresh: () => setNeedRefresh(true),
      onOfflineReady: () => setOfflineReady(true),
    });
    setUpdateSW(() => update);
  }, []);

  return {
    needRefresh,
    offlineReady,
    applyUpdate: () => updateSW?.(true),
    dismissOfflineReady: () => setOfflineReady(false),
  };
}
