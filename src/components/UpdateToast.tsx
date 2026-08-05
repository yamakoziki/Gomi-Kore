import { useTranslation } from "react-i18next";
import { usePwaUpdate } from "../hooks/usePwaUpdate";

export function UpdateToast() {
  const { t } = useTranslation();
  const { needRefresh, offlineReady, applyUpdate, dismissOfflineReady } = usePwaUpdate();

  if (!needRefresh && !offlineReady) return null;

  return (
    <div className="update-toast" role="status">
      <span>{needRefresh ? t("pwa.needRefresh") : t("pwa.offlineReady")}</span>
      {needRefresh ? (
        <button type="button" onClick={() => applyUpdate()}>
          {t("pwa.reload")}
        </button>
      ) : (
        <button type="button" onClick={dismissOfflineReady}>
          {t("pwa.dismiss")}
        </button>
      )}
    </div>
  );
}
