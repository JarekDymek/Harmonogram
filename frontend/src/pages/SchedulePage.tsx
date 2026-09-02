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
import { isValidatedPlan } from "../generation";
import { VALIDATOR_VERSION } from "../workRules";
import { calendarDuties, fixedNightHours } from "../nightDuties";

function educatorColor(educatorId: string) {
  let hash = 0;
  for (const character of educatorId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return `hsl(${hash % 360} 58% 88%)`;
}

export function SchedulePage() {
  const navigate = useNavigate();
  const { configuration, generation, generationNotice, generate, busy } = useAppState();
  const [week, setWeek] = useState(1);
  const [view, setView] = useState<"week" | "educator">("week");
  const [exportingWord, setExportingWord] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
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
    const result = await generate({
      timeLimitSeconds: generation?.generationStatus === "TIME_LIMIT" ? 180 : 60,
    });
    if (result?.publicResult === "BRAK_ROZWIAZANIA") {
      navigate("/brak-rozwiazania");
    }
  };

  const exportWord = async () => {
    if (!configuration || !isValidatedPlan(generation)) return;
    setExportingWord(true);
    setExportMessage("");
    try {
      const { downloadScheduleDocx } = await import("../scheduleDocx");
      const fileName = await downloadScheduleDocx(configuration, generation);
      setExportMessage(
        `Pobrano edytowalny dokument Word „${fileName}” ze wszystkimi tygodniami.`,
      );
    } catch {
      setExportMessage(
        "Nie udało się utworzyć dokumentu Word. Gotowy plan pozostał zapisany w aplikacji.",
      );
    } finally {
      setExportingWord(false);
    }
  };

  if (!isValidatedPlan(generation)) {
    const hasAttempt = generation !== null;
    const stale = generation?.validationReport?.status === "VALID" && generation.validationReport.validatorVersion !== VALIDATOR_VERSION;
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
          title={stale ? "Przelicz plan według nowych zasad dni pracy" : title}
          description={
            stale ? "Dane i poprzedni wynik zachowano. Nowa kontrola wymaga dokładnie 5 dni pracy osób podstawowych, uwzględnia stały plan pomocniczy, szkołę, obie daty nocki i zapisane wolne za weekend. Kliknij Uruchom generator. Nie trzeba wpisywać danych ponownie." : hasAttempt
              ? "Nie masz jeszcze sprawdzonego planu. Brak wyniku nie oznacza błędu godzin — poniżej podajemy rzeczywistą przyczynę."
              : "Aplikacja najpierw ułoży propozycję spełniającą wymagane warunki, a następnie niezależnie ją sprawdzi."
          }
        />
        {generation && !stale && (
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
          <h2>{generation?.generationStatus === "TIME_LIMIT" ? "Potrzebna jest dłuższa próba obliczeń" : "Ułóż propozycję planu"}</h2>
          <p>
            Nie musisz ponownie wpisywać danych. Poprawny plan pojawi się bez czekania na idealny podział preferencji.
          </p>
          <button
            className="button button--primary"
            type="button"
            disabled={busy}
            onClick={() => void run()}
          >
            {busy ? "Układam i sprawdzam plan…" : generation?.generationStatus === "TIME_LIMIT" ? "Szukaj dłużej" : "Uruchom generator"}
          </button>
        </section>
        {!stale && generation?.messages.length ? (
          <section className="section-block">
            <MessagesTable messages={generation.messages} configuration={configuration} />
          </section>
        ) : null}
      </>
    );
  }

  const allWeekAssignments = generation.assignments.filter((item) =>
    weekDates.includes(item.date),
  );
  const duties = calendarDuties(configuration).filter(d => weekDates.includes(d.date));
  const allWorkDates = (educatorId: string) => new Set([
    ...allWeekAssignments.filter(a => a.educatorId === educatorId).map(a => a.date),
    ...duties.filter(a => a.educatorId === educatorId).map(a => a.date),
    ...configuration.lockedAssignments.filter(a => a.educatorId === educatorId && weekDates.includes(a.date)).map(a => a.date),
  ]);
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
    const membership = configuration.groupMemberships.find(
      (item) =>
        item.educatorId === educator.id &&
        item.groupId === configuration.activeGroupId,
    )!;
    return {
      educator,
      minutes: relevant.reduce(
        (sum, item) => sum + item.endMinute - item.startMinute,
        0,
      ),
      days: allWorkDates(educator.id).size,
      nightMinutes: fixedNightHours(configuration, membership, week - 1) * 60,
      fixedPartialSchedule: membership.fixedPartialSchedule ?? false,
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
      days: allWorkDates(educator.id).size,
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
            <button
              className="button button--primary"
              type="button"
              disabled={exportingWord}
              onClick={() => void exportWord()}
            >
              {exportingWord ? "Tworzę Word…" : "Pobierz Word (.docx)"}
            </button>
            <button className="button button--secondary" type="button" onClick={() => navigate("/internat")}>Cały internat</button>
            <button className="button button--secondary" type="button" onClick={() => navigate("/walidacja")}>Otwórz raport walidacji</button>
          </div>
        }
      />
      {exportMessage && (
        <p className="form-message" role="status">
          {exportMessage}
        </p>
      )}
      {generation.publicResult === "POPRAWNY_TRYB_DEMONSTRACYJNY" && (
        <DemoNotice>
          {generation.validationReport?.demonstrationUseProhibitedNotice}
        </DemoNotice>
      )}
      <section className="next-step-card" aria-label="Poprawna propozycja planu">
        <div>
          <h2>Propozycja planu jest gotowa i sprawdzona</h2>
          <p>Wymagane godziny, dostępność, nocki i odpoczynki przeszły kontrolę. Niżej zobaczysz, które dni można jeszcze wygodniej podzielić. Ulepszanie jest opcjonalne i nie usuwa gotowego planu.</p>
          {generationNotice && <p role="status">{generationNotice}</p>}
        </div>
        <button className="button button--secondary" type="button" disabled={busy}
          onClick={() => void generate({ optimize: true })}>
          {busy ? "Szukam lepszego układu…" : "Spróbuj ulepszyć podział"}
        </button>
      </section>
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
          <small>Kontrola wymaganych warunków</small>
          <strong>ZALICZONA</strong>
        </div>
        <div>
          <small>Następna pozycja weekendu</small>
          <strong>{generation.nextWeekendVariant ?? "—"}</strong>
        </div>
        <div>
          <small>Układ planu</small>
          <StatusBadge
            value={
              generation.optimizationProven
                ? "NAJLEPSZY POTWIERDZONY"
                : "POPRAWNA PROPOZYCJA"
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
                {duties.filter(d => d.date === date && memberIds.has(d.educatorId)).map(d => <div className="shift" key={`${d.id}-${date}`} style={{ backgroundColor: educatorColor(d.educatorId) }}>
                  <span>{configuration.educators.find(e => e.id === d.educatorId)?.shortCode}</span>
                  <strong>{minutesToTime(d.startMinute)}–{minutesToTime(d.endMinute)}</strong>
                  <small>{d.dutyType === "NIGHT" ? "Nocka — dzień pracy" : d.dutyType === "SCHOOL" ? "Szkoła — dzień pracy" : "Inny dyżur"}</small>
                </div>)}
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
                  {educator.shortCode}
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
                        .join(", ") || (allWorkDates(educator.id).has(date) ? "praca poza opieką tej grupy" : "wolne od wszystkich prac")}
                    </strong>
                    {duties.filter(d => d.date === date && d.educatorId === educator.id).map(d => <small key={d.id}>{d.dutyType === "NIGHT" ? "Nocka" : "Szkoła / inny dyżur"} {minutesToTime(d.startMinute)}–{minutesToTime(d.endMinute)}</small>)}
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
                {item.educator.shortCode}
              </span>
              <div>
                <small>{item.educator.displayName}</small>
                <strong>{formatMinutes(item.minutes + item.nightMinutes)}</strong>
                <small>Opieka {formatMinutes(item.minutes)} + stałe nocki {formatMinutes(item.nightMinutes)}</small>
                <span>
                  {item.fixedPartialSchedule
                    ? `${item.days} dni w tym planie · pozostała praca poza zakresem`
                    : `${item.days} dni pracy łącznie · ${7 - item.days} całkowicie wolnych`}
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
        <details className="section-block">
          <summary>Techniczne szczegóły oceny układu (opcjonalne)</summary>
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
        </details>
      )}

      {generation.qualityReport?.weeks.find((item) => item.weekNumber === week) && (
        <section className="section-block">
          <div className="section-heading"><div><span className="eyebrow">OPCJONALNE ULEPSZENIA</span><h2>Gdzie można szukać wygodniejszego podziału</h2><p>To nie są błędy planu. Przycisk „Spróbuj ulepszyć podział” poszuka układu z mniejszą liczbą przerw i zmian osób. Zachowanie wszystkich wymaganych warunków ma pierwszeństwo.</p></div></div>
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
