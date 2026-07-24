import { EmptyState, PageHeader, StatusBadge } from "../components/UI";
import { useAppState } from "../state/AppState";

export function NoSolutionPage() {
  const { generation } = useAppState();
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
        title="Warunki nie mogą być spełnione jednocześnie"
        description={conflict.summary}
      />
      <section className="conflict-card">
        <header>
          <div>
            <small>Jakość analizy</small>
            <StatusBadge value={conflict.conflictAnalysisQuality} />
          </div>
          <strong>{conflict.conflictingRuleIds.length} grup reguł</strong>
        </header>
        <div className="conflict-columns">
          <div>
            <h2>Reguły do sprawdzenia</h2>
            <ul>
              {conflict.conflictingRuleIds.map((item) => (
                <li key={item}>
                  <code>{item}</code>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Dane wejściowe</h2>
            <ul>
              {conflict.inputFieldsToReview.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Osoby i daty</h2>
            <p>{conflict.educatorIds.join(", ") || "—"}</p>
            <p>
              {conflict.dates.length
                ? `${conflict.dates[0]} – ${conflict.dates.at(-1)}`
                : "—"}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
