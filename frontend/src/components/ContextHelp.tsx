import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { getPageHelp } from "../help";

export function ContextHelp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { pathname } = useLocation();
  const help = getPageHelp(pathname);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        className="help-backdrop"
        type="button"
        aria-label="Zamknij podpowiedzi"
        onClick={onClose}
      />
      <aside
        id="context-help"
        className="help-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="context-help-title"
      >
        <header className="help-drawer__header">
          <div>
            <span className="eyebrow">PODPOWIEDZI DLA TEGO EKRANU</span>
            <h2 id="context-help-title">{help.title}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Zamknij podpowiedzi"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <p className="help-drawer__intro">{help.intro}</p>
        <ol className="help-steps">
          {help.steps.map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
        {help.note && (
          <div className="help-note">
            <strong>Ważne</strong>
            <p>{help.note}</p>
          </div>
        )}
        {pathname !== "/podsumowanie" && (
          <Link
            className="button button--primary help-drawer__summary-link"
            to="/podsumowanie"
            onClick={onClose}
          >
            Przejdź do sprawdzenia danych
          </Link>
        )}
      </aside>
    </>
  );
}
