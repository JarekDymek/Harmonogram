import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DAY_NAMES,
  DemoNotice,
  EmptyState,
  MessagesTable,
  PageHeader,
  StatusBadge,
  formatMinutes,
  minutesToTime,
} from "../components/UI";
import { useAppState } from "../state/AppState";

export function SchedulePage() {
  const navigate = useNavigate();
  const { configuration, generation, generate, busy } = useAppState();
  const [week, setWeek] = useState(1);
  const [view, setView] = useState<"week" | "educator">("week");

  const weekDates = useMemo(() => {
    if (!configuration) return [];
    const start = new Date(`${configuration.cycleStartDate}T12:00:00Z`);
    return Array.from({ length: 7 }, (_, day) => {
      const value = new Date(start);
      value.setUTCDate(start.getUTCDate() + (week - 1) * 7 + day);
      return value.toISOString().slice(0, 10);
    });
  }, [configuration, week]);

  if (!configuration) return <EmptyState>Najpierw utwórz konfigurację.</EmptyState>;

  const run = async () => {
    const result = await generate();
    if (result?.publicResult === "BRAK_ROZWIAZANIA") {
      navigate("/brak-rozwiazania");
    }
  };

  if (!generation || !generation.assignments.length) {
    const hasAttempt = generation !== null;
    const title =
      generation?.publicResult === "NIE_ZAKONCZONO_WYSZUKIWANIA"
        ? "Wyszukiwanie nie zostało zakończone"
        : generation?.publicResult === "BLAD_WEWNETRZNY"
          ? "Wynik został odrzucony"
          : "Harmonogram nie został jeszcze wygenerowany";
    return (
      <>
        <PageHeader
          eyebrow="KROK 08 · WYNIK"
          title={title}
          description={
            hasAttempt
              ? "Aplikacja nie publikuje kandydata po limicie czasu ani wyniku odrzuconego przez niezależny walidator."
              : "Solver opublikuje wynik dopiero po przejściu niezależnej walidacji."
          }
        />
        {generation && (
          <section className="validation-summary">
            <div>
              <small>Status generatora</small>
              <StatusBadge value={generation.generationStatus} />
            </div>
            <div>
              <small>Wynik publiczny</small>
              <StatusBadge value={generation.publicResult} />
            </div>
          </section>
        )}
        <section className="empty-state">
          <span aria-hidden="true">▦</span>
          <h2>Gotowy do uruchomienia</h2>
          <p>
            Wróć do podsumowania i sprawdź dane albo uruchom generator teraz.
          </p>
          <button
            className="button button--primary"
            type="button"
            disabled={busy}
            onClick={() => void run()}
          >
            {busy ? "Solver pracuje…" : "Uruchom generator"}
          </button>
        </section>
        {generation?.messages.length ? (
          <section className="section-block">
            <MessagesTable messages={generation.messages} />
          </section>
        ) : null}
      </>
    );
  }

  const assignments = generation.assignments.filter((item) =>
    weekDates.includes(item.date),
  );
  const weekSummary = configuration.educators.map((educator) => {
    const relevant = assignments.filter((item) => item.educatorId === educator.id);
    return {
      educator,
      minutes: relevant.reduce(
        (sum, item) => sum + item.endMinute - item.startMinute,
        0,
      ),
      days: new Set(relevant.map((item) => item.date)).size,
      splitDays: weekDates.filter(
        (date) =>
          relevant.filter((item) => item.date === date).length > 1,
      ).length,
    };
  });

  return (
    <>
      <PageHeader
        eyebrow="KROK 08 · WYNIK"
        title="Sześciotygodniowy harmonogram"
        description="Każdy odcinek pochodzi z wyniku zatwierdzonego przez niezależny walidator."
        actions={
          <button
            className="button button--secondary"
            type="button"
            onClick={() => navigate("/walidacja")}
          >
            Otwórz raport walidacji
          </button>
        }
      />
      {generation.publicResult === "POPRAWNY_TRYB_DEMONSTRACYJNY" && (
        <DemoNotice>
          {generation.validationReport?.demonstrationUseProhibitedNotice}
        </DemoNotice>
      )}
      <section className="result-bar">
        <div>
          <small>Wynik publiczny</small>
          <StatusBadge value={generation.publicResult} />
        </div>
        <div>
          <small>Odcinki w cyklu</small>
          <strong>{generation.assignments.length}</strong>
        </div>
        <div>
          <small>Wynik preferencji</small>
          <strong>{generation.objective?.objectiveScore ?? "—"}</strong>
        </div>
        <div className="segmented-control" aria-label="Rodzaj widoku">
          <button
            className={view === "week" ? "active" : ""}
            type="button"
            onClick={() => setView("week")}
          >
            Tydzień
          </button>
          <button
            className={view === "educator" ? "active" : ""}
            type="button"
            onClick={() => setView("educator")}
          >
            Osoby
          </button>
        </div>
      </section>
      <div className="week-tabs" aria-label="Wybór tygodnia">
        {[1, 2, 3, 4, 5, 6].map((value) => (
          <button
            key={value}
            type="button"
            className={week === value ? "active" : ""}
            onClick={() => setWeek(value)}
          >
            <span>0{value}</span>
            Tydzień {value}
          </button>
        ))}
      </div>

      {view === "week" ? (
        <section className="schedule-board">
          {weekDates.map((date, dayIndex) => (
            <article className="schedule-day" key={date}>
              <header>
                <span>{DAY_NAMES[dayIndex]}</span>
                <strong>{date.slice(8, 10)}</strong>
                <small>{date.slice(5, 7)}.2026</small>
              </header>
              <div>
                {assignments
                  .filter((item) => item.date === date)
                  .sort((a, b) => a.startMinute - b.startMinute)
                  .map((item) => {
                    const educator = configuration.educators.find(
                      (value) => value.id === item.educatorId,
                    );
                    return (
                      <div
                        className={`shift shift--${item.educatorId.toLowerCase()}`}
                        key={`${item.educatorId}-${item.startMinute}`}
                      >
                        <span>{educator?.shortCode ?? item.educatorId}</span>
                        <strong>
                          {minutesToTime(item.startMinute)}–
                          {minutesToTime(item.endMinute)}
                        </strong>
                        {dayIndex >= 5 && <small>Wzorzec weekendowy</small>}
                      </div>
                    );
                  })}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="educator-schedule">
          {configuration.educators.map((educator) => (
            <article key={educator.id}>
              <header>
                <div className={`avatar avatar--${educator.id}`}>
                  {educator.id}
                </div>
                <div>
                  <h2>{educator.displayName}</h2>
                  <small>{educator.shortCode}</small>
                </div>
              </header>
              <div className="person-week">
                {weekDates.map((date, dayIndex) => (
                  <div key={date}>
                    <span>{DAY_NAMES[dayIndex].slice(0, 3)}</span>
                    <strong>
                      {assignments
                        .filter(
                          (item) =>
                            item.date === date &&
                            item.educatorId === educator.id,
                        )
                        .map(
                          (item) =>
                            `${minutesToTime(item.startMinute)}–${minutesToTime(item.endMinute)}`,
                        )
                        .join(", ") || "wolne"}
                    </strong>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TYDZIEŃ {week}</span>
            <h2>Podsumowanie osób</h2>
          </div>
        </div>
        <div className="metric-grid metric-grid--three">
          {weekSummary.map((item) => (
            <div className="metric person-metric" key={item.educator.id}>
              <span className={`avatar avatar--${item.educator.id}`}>
                {item.educator.id}
              </span>
              <div>
                <small>{item.educator.displayName}</small>
                <strong>{formatMinutes(item.minutes)}</strong>
                <span>
                  {item.days} dni · {item.splitDays} dzielonych
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {generation.objective && (
        <section className="section-block">
          <div className="section-heading">
            <div>
              <span className="eyebrow">FUNKCJA CELU</span>
              <h2>Składniki jakości</h2>
            </div>
          </div>
          <div className="objective-grid">
            <div><span>Przekazania</span><strong>{generation.objective.afternoonPenalty}</strong></div>
            <div><span>Weekend</span><strong>{generation.objective.weekendPenalty}</strong></div>
            <div><span>Dni dzielone</span><strong>{generation.objective.splitDaysPenalty}</strong></div>
            <div><span>Długie odcinki</span><strong>{generation.objective.longSegmentsPenalty}</strong></div>
            <div><span>PREFERRED</span><strong>{generation.objective.preferredUnavailabilityPenalty}</strong></div>
          </div>
        </section>
      )}
    </>
  );
}
