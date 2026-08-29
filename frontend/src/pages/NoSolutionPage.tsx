import { Link } from "react-router-dom";
import { EmptyState, MessagesTable, PageHeader, StatusBadge } from "../components/UI";
import { useAppState } from "../state/AppState";

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
  return (
    <>
      <PageHeader
        eyebrow="BRAK ROZWIĄZANIA"
        title="Nie udało się jeszcze ułożyć planu"
        description="Nie zmieniaj wszystkich danych. Zacznij od pierwszej konkretnej wskazówki poniżej."
      />
      <section className="next-step-card next-step-card--error">
        <div>
          <span className="eyebrow">CO ZROBIĆ TERAZ</span>
          <h2>Zacznij od pierwszej wskazanej pozycji</h2>
          <p>{conflict.summary}</p>
        </div>
        <Link className="button button--secondary" to="/podsumowanie">
          Sprawdź dane ponownie
        </Link>
      </section>
      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">KONKRETNE WSKAZÓWKI</span>
            <h2>Co blokuje plan</h2>
          </div>
        </div>
        <MessagesTable
          messages={generation?.messages ?? []}
          configuration={configuration ?? undefined}
        />
      </section>
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
