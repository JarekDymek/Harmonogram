import { Link } from "react-router-dom";
import { EmptyState, MessagesTable, PageHeader, StatusBadge } from "../components/UI";
import { RepairGuide } from "../components/RepairGuide";
import { useAppState } from "../state/AppState";
import { getRuleGuidance } from "../help";

export function NoSolutionPage() {
  const { configuration, generation } = useAppState();
  const conflict = generation?.conflictReport;
  if (!conflict) {
    return (
      <EmptyState title="Brak raportu konfliktu">
        Raport pojawi się, gdy solver udowodni brak rozwiązania.
      </EmptyState>
    );
  }
  const messages = generation?.messages ?? [];
  const errors = messages.filter((message) => message.severity === "ERROR"
    && getRuleGuidance(message, configuration ?? undefined).repairable !== false);
  const remainingMessages = messages.filter(
    (message) => !errors.includes(message),
  );
  return (
    <>
      <PageHeader
        eyebrow="BRAK ROZWIĄZANIA"
        title="Nie udało się jeszcze ułożyć planu"
        description={errors.length ? "Poniżej wskazano konkretne kolizje do uzgodnienia." : "Nie ustalono konkretnego wpisu do poprawy. Nie zmieniaj godzin ani reguł na chybił trafił."}
      />
      {errors.length > 0 ? (
        <RepairGuide
          messages={errors}
          configuration={configuration ?? undefined}
          recheckTo="/podsumowanie"
        />
      ) : remainingMessages.length === 0 ? (
        <section className="next-step-card next-step-card--error">
          <div>
            <span className="eyebrow">CO ZROBIĆ TERAZ</span>
            <h2>Potrzebna jest analiza zapisanego projektu</h2>
            <p>{conflict.summary}</p>
          </div>
          <Link className="button button--secondary" to="/urzadzenia">
            Przejdź do eksportu projektu
          </Link>
        </section>
      ) : null}
      {remainingMessages.length > 0 && (
        <section className="section-block">
          <div className="section-heading">
            <div>
              <span className="eyebrow">DODATKOWE INFORMACJE</span>
              <h2>Informacje o wyniku</h2>
            </div>
          </div>
          <MessagesTable
            messages={remainingMessages}
            configuration={configuration ?? undefined}
          />
        </section>
      )}
      <details className="section-block summary-details">
        <summary>
          <span>
            <span className="eyebrow">DLA SERWISU</span>
            <strong>Pokaż informacje techniczne</strong>
          </span>
          <span aria-hidden="true">＋</span>
        </summary>
        <div className="summary-details__content conflict-columns">
          <div>
            <h2>Reguły</h2>
            <ul>
              {conflict.conflictingRuleIds.map((item) => (
                <li key={item}><code>{item}</code></li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Pola wejściowe</h2>
            <ul>
              {conflict.inputFieldsToReview.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Jakość analizy</h2>
            <StatusBadge value={conflict.conflictAnalysisQuality} />
          </div>
        </div>
      </details>
    </>
  );
}
