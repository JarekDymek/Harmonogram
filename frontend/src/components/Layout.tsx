import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
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
  ["/walidacja", "Walidacja", "09"],
] as const;

export function Layout() {
  const [open, setOpen] = useState(false);
  const { configuration, busy, error, clearError } = useAppState();
  return (
    <div className="app-shell">
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
            <small>MOW · cykl 6 tygodni</small>
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
            className={`connection-dot ${busy ? "connection-dot--busy" : ""}`}
            aria-hidden="true"
          />
          {busy ? "Backend pracuje…" : "Dane zapisywane lokalnie"}
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
            <strong>{configuration?.groupName ?? "Brak konfiguracji"}</strong>
          </div>
          {configuration && (
            <span
              className={`mode-pill mode-pill--${configuration.requestedOperationMode.toLowerCase()}`}
            >
              {configuration.requestedOperationMode === "DEMONSTRATION"
                ? "Tryb demonstracyjny"
                : "Tryb produkcyjny"}
            </span>
          )}
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
        <main id="main-content" className="main-content">
          <Outlet />
        </main>
      </div>
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
