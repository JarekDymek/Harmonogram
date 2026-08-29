import { NavLink, Outlet } from "react-router-dom";
import { useCallback, useState } from "react";
import { ContextHelp } from "./ContextHelp";
import { HashFocus } from "./HashFocus";
import { useOnlineStatus, usePwaInstall } from "../pwa";
import { useAppState } from "../state/AppState";

const navigation = [
  ["/", "Start", "01"],
  ["/konfiguracja", "Konfiguracja", "02"],
  ["/wychowawcy", "Wychowawcy", "03"],
  ["/plany", "Plan pobytu", "04"],
  ["/weekendy", "Weekendy", "05"],
  ["/reguly", "Reguły", "06"],
  ["/podsumowanie", "Podsumowanie", "07"],
  ["/harmonogram", "Harmonogram", "08"],
  ["/internat", "Cały internat", "09"],
  ["/walidacja", "Walidacja", "10"],
] as const;

export function Layout() {
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const { configuration, busy, error, clearError, migrationPending, setActiveGroup } =
    useAppState();
  const online = useOnlineStatus();
  const { canInstall, installed, install } = usePwaInstall();
  return (
    <div className="app-shell">
      <HashFocus />
      <a className="skip-link" href="#main-content">
        Przejdź do treści
      </a>
      <aside className={`sidebar ${open ? "sidebar--open" : ""}`}>
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            H
          </span>
          <div>
            <strong>Harmonogram</strong>
            <small>MOW · 1–6 tygodni</small>
          </div>
        </div>
        <nav aria-label="Główna nawigacja">
          {navigation.map(([to, label, number]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `nav-link ${isActive ? "nav-link--active" : ""}`
              }
            >
              <span>{number}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__footer">
          <span
            className={`connection-dot ${
              busy
                ? "connection-dot--busy"
                : online
                  ? ""
                  : "connection-dot--offline"
            }`}
            aria-hidden="true"
          />
          {busy
            ? "Backend pracuje…"
            : online
              ? "Dane zapisywane lokalnie"
              : "Offline · dane lokalne"}
        </div>
      </aside>
      <div className="app-column">
        <header className="topbar">
          <button
            className="menu-button"
            type="button"
            aria-label="Otwórz menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            ☰
          </button>
          <div>
            <span className="eyebrow">AKTYWNA KONFIGURACJA</span>
            {configuration ? (
              <label className="group-switcher">
                <span className="sr-only">Aktualnie edytowana grupa</span>
                <select
                  aria-label="Aktualnie edytowana grupa"
                  value={configuration.activeGroupId}
                  onChange={(event) => setActiveGroup(event.target.value)}
                >
                  {configuration.groups
                    .filter((item) => item.active)
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.code} · {group.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : (
              <strong>Brak konfiguracji</strong>
            )}
          </div>
          <div className="topbar__actions">
            <button
              className="help-button"
              type="button"
              aria-controls="context-help"
              aria-expanded={helpOpen}
              onClick={() => setHelpOpen(true)}
            >
              <span aria-hidden="true">?</span>
              Podpowiedzi
            </button>
            {canInstall && (
              <button
                className="install-button"
                type="button"
                onClick={() => void install()}
              >
                Zainstaluj aplikację
              </button>
            )}
            {installed && (
              <span className="installed-pill" aria-label="Aplikacja zainstalowana">
                Zainstalowana
              </span>
            )}
            {configuration && (
              <span
                className={`mode-pill mode-pill--${configuration.requestedOperationMode.toLowerCase()}`}
              >
                {configuration.requestedOperationMode === "DEMONSTRATION"
                  ? "Tryb demonstracyjny"
                  : "Tryb rzeczywisty"}
              </span>
            )}
          </div>
        </header>
        {error && (
          <div className="global-error" role="alert">
            <strong>Nie udało się wykonać operacji.</strong>
            <span>{error}</span>
            <button type="button" onClick={clearError} aria-label="Zamknij błąd">
              ×
            </button>
          </div>
        )}
        {migrationPending && (
          <div className="global-error migration-notice" role="status">
            <strong>Wczytano konfigurację ze starszej wersji.</strong>
            <span>
              Wartości godzin zachowano bez zmian. Zapisz wybrany formularz,
              aby zatwierdzić migrację do nowego schematu.
            </span>
          </div>
        )}
        <main id="main-content" className="main-content">
          <Outlet />
        </main>
      </div>
      <ContextHelp open={helpOpen} onClose={closeHelp} />
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Zamknij menu"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
