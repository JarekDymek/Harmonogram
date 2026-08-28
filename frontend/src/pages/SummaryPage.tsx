import { Link, useNavigate } from "react-router-dom";
import { getRuleGuidance } from "../help";
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
  const expectedDates =
    configuration.planningHorizonWeeks *
    7 *
    configuration.selectedGroupIds.length;
  const errors =
    inputReport?.messages.filter((item) => item.severity === "ERROR") ?? [];
  const firstGuidance = errors[0] ? getRuleGuidance(errors[0]) : null;

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
        description="Najpierw kliknij „Sprawdź dane”. Jeśli coś wymaga poprawy, aplikacja pokaże prostą instrukcję i właściwy formularz."
        actions={
          <>
            <button
              className="button button--secondary"
              type="button"
              disabled={busy}
              onClick={() => void validateInput()}
            >
              1. Sprawdź dane
            </button>
            <button
              className="button button--primary"
              type="button"
              disabled={busy || inputReport?.status !== "VALID_INPUT"}
              onClick={() => void runGeneration()}
            >
              {busy ? "Przetwarzanie…" : "2. Generuj harmonogram"}
            </button>
          </>
        }
      />
      {configuration.requestedOperationMode === "DEMONSTRATION" && <DemoNotice />}
      {!inputReport ? (
        <section className="empty-state empty-state--compact">
          <span aria-hidden="true">↻</span>
          <h2>Dane nie zostały jeszcze sprawdzone</h2>
          <p>
            Uruchom walidację, aby zobaczyć bilanse i zapotrzebowanie dla
            {` ${expectedDates} dat`}.
          </p>
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
              <strong>{inputReport.care.length} / {expectedDates}</strong>
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
          {firstGuidance && (
            <section className="next-step-card" aria-labelledby="next-step-title">
              <div>
                <span className="eyebrow">CO ZROBIĆ TERAZ</span>
                <h2 id="next-step-title">{firstGuidance.title}</h2>
                <p>
                  Wykryto {errors.length} {errors.length === 1 ? "błąd" : "błędy"}.
                  Zacznij od pierwszej wskazanej pozycji, a następnie ponownie
                  sprawdź dane.
                </p>
              </div>
              <Link className="button button--primary" to={firstGuidance.actionTo}>
                {firstGuidance.actionLabel}
              </Link>
            </section>
          )}
          <section className="section-block">
            <div className="section-heading">
              <div>
                <span className="eyebrow">BILANS GODZIN</span>
                <h2>{configuration.planningHorizonWeeks} tyg.</h2>
              </div>
            </div>
            <div className="balance-grid">
              {inputReport.weeklyBalance.map((item) => (
                <article
                  className={`balance-card ${item.differenceMinutes === 0 ? "balance-card--ok" : "balance-card--error"}`}
                  key={`${item.groupId ?? "G"}-${item.weekNumber}`}
                >
                  <header>
                    <span>{item.groupId ? `${configuration.groups.find((group) => group.id === item.groupId)?.code} · ` : ""}Tydzień {item.weekNumber}</span>
                    <strong>
                      {item.differenceMinutes > 0 ? "+" : ""}
                      {formatMinutes(item.differenceMinutes)}
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
                <h2>{expectedDates} dat</h2>
              </div>
            </div>
            <div className="care-list">
              {inputReport.care.map((day) => (
                <div className="care-row" key={`${day.groupId}-${day.date}`}>
                  <span>
                    <strong>{day.date}</strong>
                    <small>{configuration.groups.find((group) => group.id === day.groupId)?.code} · Tydzień {day.weekNumber}</small>
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
            <MessagesTable
              messages={inputReport.messages}
              configuration={configuration}
            />
          </section>
        </>
      )}
    </>
  );
}
