import { useEffect, useMemo, useState } from "react";
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

function educatorColor(educatorId: string) {
  let hash = 0;
  for (const character of educatorId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return `hsl(${hash % 360} 58% 88%)`;
}

export function SchedulePage() {
  const navigate = useNavigate();
  const { configuration, generation, generate, busy } = useAppState();
  const [week, setWeek] = useState(1);
  const [view, setView] = useState<"week" | "educator">("week");
  useEffect(() => {
    if (
      configuration &&
      week > configuration.planningHorizonWeeks
    ) {
      setWeek(configuration.planningHorizonWeeks);
    }
  }, [configuration, week]);

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

  const allWeekAssignments = generation.assignments.filter((item) =>
    weekDates.includes(item.date),
  );
  const assignments = allWeekAssignments.filter(
    (item) => item.groupId === configuration.activeGroupId,
  );
  const memberIds = new Set(
    configuration.groupMemberships
      .filter(
        (item) =>
          item.active && item.groupId === configuration.activeGroupId,
      )
      .map((item) => item.educatorId),
  );
  const groupEducators = configuration.educators.filter((item) =>
    memberIds.has(item.id),
  );
  const weekSummary = groupEducators.map((educator) => {
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
  const globalSummary = configuration.educators.map((educator) => {
    const relevant = allWeekAssignments.filter(
      (item) => item.educatorId === educator.id,
    );
    return {
      educator,
      minutes: relevant.reduce(
        (sum, item) => sum + item.endMinute - item.startMinute,
        0,
      ),
      days: new Set(relevant.map((item) => item.date)).size,
    };
  });

  return (
    <>
      <PageHeader
        eyebrow="KROK 08 · WYNIK"
        title={`Harmonogram grupy ${configuration.groupName}`}
        description="Szczegół wybranej grupy; kontrola kolizji i odpoczynków została wykonana globalnie dla całego internatu."
        actions={
          <div className="button-row">
            <button className="button button--secondary" type="button" onClick={() => navigate("/internat")}>Cały internat</button>
            <button className="button button--secondary" type="button" onClick={() => navigate("/walidacja")}>Otwórz raport walidacji</button>
          </div>
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
          <small>Odcinki w horyzoncie</small>
          <strong>{generation.assignments.length}</strong>
        </div>
        <div>
          <small>Wynik preferencji</small>
          <strong>{generation.objective?.objectiveScore ?? "—"}</strong>
        </div>
        <div>
          <small>Następna pozycja weekendu</small>
          <strong>{generation.nextWeekendVariant ?? "—"}</strong>
        </div>
        <div>
          <small>Optymalność celu</small>
          <StatusBadge
            value={
              generation.optimizationProven
                ? "UDOWODNIONA"
                : "NAJLEPSZA ZNALEZIONA"
            }
          />
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
        {Array.from(
          { length: configuration.planningHorizonWeeks },
          (_, index) => index + 1,
        ).map((value) => (
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
                <small>
                  {date.slice(5, 7)}.{date.slice(0, 4)}
                </small>
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
                        style={{ backgroundColor: educatorColor(item.educatorId) }}
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
          {groupEducators.map((educator) => (
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

      {configuration.groupCount > 1 && (
        <section className="section-block">
          <div className="section-heading"><div><span className="eyebrow">CAŁY INTERNAT · TYDZIEŃ {week}</span><h2>Globalne godziny i dni pracy</h2></div></div>
          <div className="metric-grid metric-grid--three">
            {globalSummary.filter((item) => item.minutes > 0).map((item) => (
              <div className="metric person-metric" key={item.educator.id}>
                <span className="avatar" style={{ backgroundColor: educatorColor(item.educator.id) }}>{item.educator.shortCode}</span>
                <div><small>{item.educator.displayName}</small><strong>{formatMinutes(item.minutes)}</strong><span>{item.days} dni globalnie</span></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {generation.objective && (
        <section className="section-block">
          <div className="section-heading">
            <div>
              <span className="eyebrow">FUNKCJA CELU</span>
              <h2>Składniki jakości</h2>
            </div>
          </div>
          <div className="objective-grid">
            <div><span>Przekazania w blokach</span><strong>{generation.objective.continuousBlockHandovers}</strong></div>
            <div><span>Osoby ponad pierwszą</span><strong>{generation.objective.distinctEducatorsPerBlock}</strong></div>
            <div><span>Wszystkie odcinki</span><strong>{generation.objective.totalSegments}</strong></div>
            <div><span>Krótkie środkowe</span><strong>{generation.objective.shortMiddleSegments}</strong></div>
            <div><span>Odchylenie godziny przekazania</span><strong>{generation.objective.afternoonPenalty}</strong></div>
            <div><span>Weekend</span><strong>{generation.objective.weekendPenalty}</strong></div>
            <div><span>Dni dzielone</span><strong>{generation.objective.splitDaysPenalty}</strong></div>
            <div><span>Długie odcinki</span><strong>{generation.objective.longSegmentsPenalty}</strong></div>
            <div><span>PREFERRED</span><strong>{generation.objective.preferredUnavailabilityPenalty}</strong></div>
          </div>
        </section>
      )}

      {generation.qualityReport?.weeks.find((item) => item.weekNumber === week) && (
        <section className="section-block">
          <div className="section-heading"><div><span className="eyebrow">RAPORT JAKOŚCI</span><h2>Podziały ciągłych bloków</h2></div></div>
          {(() => {
            const quality = generation.qualityReport!.weeks.find((item) => item.weekNumber === week)!;
            return (
              <>
                <div className="objective-grid">
                  <div><span>Dni dzielone</span><strong>{quality.splitWorkDays}</strong></div>
                  <div><span>Przekazania</span><strong>{quality.handovers}</strong></div>
                  <div><span>Bloki: 1 osoba</span><strong>{quality.blocksWithOneEducator}</strong></div>
                  <div><span>Bloki: 2 osoby</span><strong>{quality.blocksWithTwoEducators}</strong></div>
                  <div><span>Bloki: 3 osoby</span><strong>{quality.blocksWithThreeEducators}</strong></div>
                </div>
                <div className="record-list">
                  {quality.multiEducatorBlocks.map((item) => (
                    <div className="record-row" key={`${item.groupId}-${item.date}-${item.startMinute}`}>
                      <span>{configuration.groups.find((group) => group.id === item.groupId)?.code}</span>
                      <strong>{item.date} · {minutesToTime(item.startMinute)}–{minutesToTime(item.endMinute)} · {item.educatorIds.map((id) => configuration.educators.find((educator) => educator.id === id)?.shortCode ?? id).join(" → ")}</strong>
                      <small>{item.explanation}</small>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </section>
      )}
    </>
  );
}
