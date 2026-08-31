import { Link, useNavigate } from "react-router-dom";
import { RepairGuide } from "../components/RepairGuide";
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
  const remainingMessages = inputReport?.messages.filter(
    (item) =>
      item.severity !== "ERROR" &&
      !(
        item.ruleId === "REQ-HOURS-001" &&
        typeof item.context.weekNumber === "number" &&
        typeof item.context.differenceMinutes === "number"
      ),
  ) ?? [];

  const runGeneration = async () => {
    const validation = await validateInput();
    if (!validation || validation.status !== "VALID_INPUT") return;
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
        description="Kliknij jeden przycisk. Aplikacja najpierw sprawdzi dane, a jeśli są poprawne — od razu wygeneruje harmonogram."
        actions={
          <button
            className="button button--primary"
            type="button"
            disabled={busy}
            onClick={() => void runGeneration()}
          >
            {busy ? "Sprawdzanie i generowanie…" : "Sprawdź i wygeneruj harmonogram"}
          </button>
        }
      />
      {configuration.requestedOperationMode === "DEMONSTRATION" && <DemoNotice />}
      {!inputReport ? (
        <section className="empty-state empty-state--compact">
          <span aria-hidden="true">↻</span>
          <h2>Dane nie zostały jeszcze sprawdzone</h2>
          <p>
            Wybierz „Sprawdź i wygeneruj harmonogram”. Jeśli coś jest nie tak,
            zobaczysz dokładną osobę, tydzień i miejsce poprawy dla
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
          {errors.length > 0 && (
            <RepairGuide
              messages={errors}
              configuration={configuration}
              busy={busy}
              onRecheck={() => void validateInput()}
            />
          )}
          <section className="section-block">
            <div className="section-heading">
              <div>
                <span className="eyebrow">BILANS GODZIN</span>
                <h2>{configuration.planningHorizonWeeks} tyg.</h2>
              </div>
            </div>
            <div className="balance-grid">
              {inputReport.weeklyBalance.map((item) => {
                const mismatch = item.differenceMinutes !== 0;
                const missing = item.differenceMinutes < 0;
                const group = item.groupId
                  ? configuration.groups.find((candidate) => candidate.id === item.groupId)
                  : undefined;
                const groupQuery = item.groupId
                  ? `?grupa=${encodeURIComponent(item.groupId)}`
                  : "";
                return (
                  <article
                    className={`balance-card ${mismatch ? "balance-card--error" : "balance-card--ok"}`}
                    key={`${item.groupId ?? "G"}-${item.weekNumber}`}
                  >
                    <header>
                      <span>{group ? `${group.code} · ` : ""}Tydzień {item.weekNumber}</span>
                      <strong>
                        {mismatch
                          ? `${missing ? "Brakuje" : "Za dużo o"} ${formatMinutes(Math.abs(item.differenceMinutes))}`
                          : "Zgadza się"}
                      </strong>
                    </header>
                    <dl>
                      <div>
                        <dt>Plan opieki wymaga</dt>
                        <dd>{formatMinutes(item.requiredMinutes)}</dd>
                      </div>
                      <div>
                        <dt>Wpisano wychowawcom</dt>
                        <dd>{formatMinutes(item.assignedMinutes)}</dd>
                      </div>
                    </dl>
                    {mismatch && (
                      <p className="balance-card__instruction">
                        {missing ? "Zwiększ" : "Zmniejsz"} sumę godzin tego tygodnia o <strong>{formatMinutes(Math.abs(item.differenceMinutes))}</strong>
                      </p>
                    )}
                    <small>{item.startDate} – {item.endDate}</small>
                    {mismatch && (
                      <Link
                        className="button button--secondary balance-card__action"
                        to={`/wychowawcy${groupQuery}#godziny-tydzien-${item.weekNumber}`}
                      >
                        Popraw tydzień {item.weekNumber}
                      </Link>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
          <details className="section-block summary-details">
            <summary>
              <span>
                <span className="eyebrow">SZCZEGÓŁY PLANU OPIEKI</span>
                <strong>Pokaż rozpisanie {expectedDates} dni</strong>
              </span>
              <span aria-hidden="true">＋</span>
            </summary>
            <div className="summary-details__content">
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
            </div>
          </details>
          {remainingMessages.length > 0 && (
            <section className="section-block">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">NIE BLOKUJĄ GENEROWANIA</span>
                  <h2>Ostrzeżenia i informacje</h2>
                </div>
              </div>
              <MessagesTable
                messages={remainingMessages}
                configuration={configuration}
              />
            </section>
          )}
        </>
      )}
    </>
  );
}
