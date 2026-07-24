import { useNavigate } from "react-router-dom";
import {
  DemoNotice,
  EmptyState,
  MessagesTable,
  PageHeader,
  StatusBadge,
  Timeline,
  formatMinutes,
} from "../components/UI";
import { useAppState } from "../state/AppState";

export function SummaryPage() {
  const navigate = useNavigate();
  const {
    configuration,
    inputReport,
    busy,
    validateInput,
    generate,
  } = useAppState();
  if (!configuration) return <EmptyState>Najpierw utwórz konfigurację.</EmptyState>;

  const runGeneration = async () => {
    const result = await generate();
    if (!result) return;
    navigate(
      result.publicResult === "BRAK_ROZWIAZANIA"
        ? "/brak-rozwiazania"
        : "/harmonogram",
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="KROK 07 · KONTROLA WEJŚCIA"
        title="Podsumowanie przed generowaniem"
        description="Najpierw sprawdzane są struktura, hierarchia planów i dokładny bilans każdego tygodnia. Błędne dane nie uruchomią solvera."
        actions={
          <>
            <button
              className="button button--secondary"
              type="button"
              disabled={busy}
              onClick={() => void validateInput()}
            >
              Sprawdź dane
            </button>
            <button
              className="button button--primary"
              type="button"
              disabled={busy || inputReport?.status !== "VALID_INPUT"}
              onClick={() => void runGeneration()}
            >
              {busy ? "Przetwarzanie…" : "Generuj harmonogram"}
            </button>
          </>
        }
      />
      {configuration.requestedOperationMode === "DEMONSTRATION" && <DemoNotice />}
      {!inputReport ? (
        <section className="empty-state empty-state--compact">
          <span aria-hidden="true">↻</span>
          <h2>Dane nie zostały jeszcze sprawdzone</h2>
          <p>Uruchom walidację, aby zobaczyć bilanse i zapotrzebowanie 42 dat.</p>
        </section>
      ) : (
        <>
          <section className="validation-summary">
            <div>
              <small>Status wejścia</small>
              <StatusBadge value={inputReport.status} />
            </div>
            <div>
              <small>Daty z planem</small>
              <strong>{inputReport.care.length} / 42</strong>
            </div>
            <div>
              <small>Błędy</small>
              <strong>
                {inputReport.messages.filter((item) => item.severity === "ERROR").length}
              </strong>
            </div>
            <div>
              <small>Ostrzeżenia</small>
              <strong>
                {
                  inputReport.messages.filter(
                    (item) => item.severity === "WARNING",
                  ).length
                }
              </strong>
            </div>
          </section>
          <section className="section-block">
            <div className="section-heading">
              <div>
                <span className="eyebrow">BILANS MINUT</span>
                <h2>Sześć tygodni</h2>
              </div>
            </div>
            <div className="balance-grid">
              {inputReport.weeklyBalance.map((item) => (
                <article
                  className={`balance-card ${item.differenceMinutes === 0 ? "balance-card--ok" : "balance-card--error"}`}
                  key={item.weekNumber}
                >
                  <header>
                    <span>Tydzień {item.weekNumber}</span>
                    <strong>
                      {item.differenceMinutes > 0 ? "+" : ""}
                      {item.differenceMinutes} min
                    </strong>
                  </header>
                  <dl>
                    <div>
                      <dt>Zapotrzebowanie</dt>
                      <dd>{formatMinutes(item.requiredMinutes)}</dd>
                    </div>
                    <div>
                      <dt>Przydziały</dt>
                      <dd>{formatMinutes(item.assignedMinutes)}</dd>
                    </div>
                  </dl>
                  <small>
                    {item.startDate} – {item.endDate}
                  </small>
                </article>
              ))}
            </div>
          </section>
          <section className="section-block">
            <div className="section-heading">
              <div>
                <span className="eyebrow">ZAPOTRZEBOWANIE</span>
                <h2>42 daty</h2>
              </div>
            </div>
            <div className="care-list">
              {inputReport.care.map((day) => (
                <div className="care-row" key={day.date}>
                  <span>
                    <strong>{day.date}</strong>
                    <small>Tydzień {day.weekNumber}</small>
                  </span>
                  <Timeline intervals={day.intervals} />
                  <strong>{formatMinutes(day.totalRequiredMinutes)}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="section-block">
            <div className="section-heading">
              <div>
                <span className="eyebrow">KOMUNIKATY</span>
                <h2>Raport wejścia</h2>
              </div>
            </div>
            <MessagesTable messages={inputReport.messages} />
          </section>
        </>
      )}
    </>
  );
}
