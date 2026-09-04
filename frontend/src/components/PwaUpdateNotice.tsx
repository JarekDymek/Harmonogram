import { useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useAppState } from "../state/AppState";
import { createProjectTransferPackage } from "../transfer";

export const BEFORE_UPDATE_KEY = "harmonogram-mow-before-update-v1";

export function PwaUpdateNotice() {
  const { configuration, inputReport, generation, busy } = useAppState();
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const lastCheck = useRef(0);
  const reloadApproved = useRef(false);
  const [alreadyActivated, setAlreadyActivated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const check = () => {
    if (!registration.current || !navigator.onLine || document.visibilityState === "hidden") return;
    if (Date.now() - lastCheck.current < 60_000) return;
    lastCheck.current = Date.now();
    void registration.current.update().catch(() => { /* Offline/CDN failure: keep the current app and data. */ });
  };
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, value) { registration.current = value; check(); },
    onRegisterError() { /* Unsupported browser/offline must not interrupt work. */ },
    onNeedReload() {
      // Activation in another tab must not discard this tab's unsaved form.
      if (reloadApproved.current) window.location.reload();
      else setAlreadyActivated(true);
    },
  });
  useEffect(() => {
    const workers = navigator.serviceWorker;
    let hadController = Boolean(workers?.controller);
    const controllerChanged = () => {
      // Workbox labels updates in a first-visit tab as initial installs. Handle
      // the native event too so an explicitly approved update still reloads.
      if (reloadApproved.current) window.location.reload();
      else if (hadController) setAlreadyActivated(true);
      hadController = Boolean(workers?.controller);
    };
    workers?.addEventListener("controllerchange", controllerChanged);
    return () => workers?.removeEventListener("controllerchange", controllerChanged);
  }, []);
  useEffect(() => {
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  useEffect(() => {
    if (!refreshing) return;
    const timer = window.setTimeout(() => {
      reloadApproved.current = false;
      setRefreshing(false);
      setError("Aktualizacja nie zakończyła się. Zapisane dane pozostają bez zmian. Spróbuj ponownie po odzyskaniu połączenia.");
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [refreshing]);

  if (!needRefresh && !alreadyActivated) return null;
  const refresh = async () => {
    if (busy || refreshing) return;
    if (!window.confirm("Czy zapisałeś otwarte formularze? Odświeżenie zachowa zapisany projekt, ale niezapisane pola znikną.")) return;
    setError("");
    try {
      if (configuration) localStorage.setItem(BEFORE_UPDATE_KEY,
        JSON.stringify(createProjectTransferPackage(configuration, inputReport, generation)));
      reloadApproved.current = true;
      setRefreshing(true);
      if (alreadyActivated) window.location.reload();
      else await updateServiceWorker(true);
    } catch {
      reloadApproved.current = false;
      setRefreshing(false);
      setError("Nie udało się zabezpieczyć projektu lub uruchomić aktualizacji. Pobierz kopię w Eksport i import, a następnie spróbuj ponownie. Aplikacji nie odświeżono.");
    }
  };
  return <section className="pwa-update-notice" role="status" aria-label="Aktualizacja aplikacji">
    <div><strong>Dostępna jest poprawka aplikacji</strong>
      <p>Zapisz otwarte formularze, następnie odśwież. Nazwiska, godziny i zapisany plan pozostaną na urządzeniu. Nie musisz odinstalowywać aplikacji.</p>
      {busy && <p>Poczekaj na zakończenie bieżącej operacji.</p>}
      {error && <p role="alert">{error}</p>}
    </div>
    <button className="button button--primary" type="button" disabled={busy || refreshing} onClick={() => void refresh()}>
      {refreshing ? "Aktualizowanie…" : "Odśwież aplikację"}
    </button>
  </section>;
}
