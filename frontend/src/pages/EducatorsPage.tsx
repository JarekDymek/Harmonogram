import { SectionTiles } from "../components/SectionTiles";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { EmptyState, PageHeader, StatusBadge, formatMinutes } from "../components/UI";
import { useAppState } from "../state/AppState";
import { WorkCommitments } from "../components/WorkCommitments";
import { formatPolishHours, parsePolishHours } from "../time";
import {
  NIGHT_END_TIME,
  NIGHT_START_TIME,
  WEEKDAY_NAMES,
  createNightAssignment,
  formatNightDateTime,
  recurringNightLabel,
  fixedNightHours,
  careHours,
  replaceRecurringNights,
} from "../nightDuties";
import type { RecurringNightDuty, Unavailability } from "../types";

export function EducatorsPage() {
  const location = useLocation();
  const {
    configuration,
    inputReport,
    busy,
    setConfiguration,
    setActiveGroup,
    validateInput,
  } = useAppState();
  const [selectedEducatorId, setSelectedEducatorId] = useState("");
  const [recurringNight, setRecurringNight] = useState({
    educatorId: "",
    startDayOfWeek: 1,
  });
  const [additionalNight, setAdditionalNight] = useState({
    educatorId: "",
    startDate: "",
    startTime: NIGHT_START_TIME,
    endTime: NIGHT_END_TIME,
    description: "",
  });
  const [nightMessage, setNightMessage] = useState("");
  const [unavailable, setUnavailable] = useState({ educatorId: "", type: "HARD" as "HARD" | "PREFERRED", dayOfWeek: 0, startTime: "08:00", endTime: "10:00", description: "" });

  const activeGroup = configuration?.groups.find(
    (item) => item.id === configuration.activeGroupId,
  );
  const memberships = useMemo(
    () =>
      configuration?.groupMemberships.filter(
        (item) => item.active && item.groupId === configuration.activeGroupId,
      ) ?? [],
    [configuration],
  );

  const requestedGroupId = useMemo(
    () => new URLSearchParams(location.search).get("grupa"),
    [location.search],
  );

  useEffect(() => {
    if (
      requestedGroupId &&
      configuration?.activeGroupId !== requestedGroupId &&
      configuration?.groups.some(
        (item) => item.id === requestedGroupId && item.active,
      )
    ) {
      setActiveGroup(requestedGroupId);
    }
  }, [configuration, requestedGroupId, setActiveGroup]);

  if (!configuration || !activeGroup) return <EmptyState>Najpierw utwórz konfigurację.</EmptyState>;
  const educatorById = new Map(configuration.educators.map((item) => [item.id, item]));
  const memberIds = new Set(memberships.map((item) => item.educatorId));
  const available = configuration.educators.filter(
    (item) => item.active && !memberIds.has(item.id),
  );
  const incompleteHourMemberships = memberships.filter((membership) =>
    Array.from(
      { length: configuration.planningHorizonWeeks },
      (_, weekIndex) =>
        (membership.weeklyTargetHoursByWeek[weekIndex] ??
          membership.weeklyTargetHoursByWeek.at(-1) ??
          0) <= 0,
    ).some(Boolean),
  );
  const activeGroupBalances = inputReport?.weeklyBalance.filter(
    (item) =>
      item.groupId === activeGroup.id ||
      (!item.groupId && configuration.selectedGroupIds.length === 1),
  ) ?? [];
  const balanceByWeek = new Map(
    activeGroupBalances.map((item) => [item.weekNumber, item]),
  );
  const mismatchedWeeks = new Set(
    activeGroupBalances
      .filter((item) => item.differenceMinutes !== 0)
      .map((item) => item.weekNumber),
  );
  const enteredMinutesByWeek = Array.from(
    { length: configuration.planningHorizonWeeks },
    (_, weekIndex) =>
      memberships.reduce(
        (sum, membership) =>
          sum +
          careHours(configuration, membership, weekIndex) * 60,
        0,
      ),
  );

  const updateEducator = (educatorId: string, field: "displayName" | "shortCode" | "description", value: string) => {
    setConfiguration({
      ...configuration,
      educators: configuration.educators.map((item) =>
        item.id === educatorId ? { ...item, [field]: value } : item,
      ),
    });
  };

  const updateHours = (membershipId: string, weekIndex: number, value: string) => {
    let hours: number;
    try {
      hours = parsePolishHours(value);
    } catch {
      return;
    }
    setConfiguration({
      ...configuration,
      groupMemberships: configuration.groupMemberships.map((item) => {
        if (item.id !== membershipId) return item;
        const targets = Array.from(
          { length: configuration.planningHorizonWeeks },
          (_, index) => item.weeklyTargetHoursByWeek[index] ?? item.weeklyTargetHoursByWeek.at(-1) ?? 0,
        );
        targets[weekIndex] = hours;
        return { ...item, weeklyTargetHoursByWeek: targets };
      }),
    });
  };

  const updateMembership = (
    membershipId: string,
    updates: Partial<(typeof configuration.groupMemberships)[number]>,
  ) => {
    setConfiguration({
      ...configuration,
      groupMemberships: configuration.groupMemberships.map((item) =>
        item.id === membershipId ? { ...item, ...updates } : item,
      ),
    });
  };

  const copyFirstWeekToAll = (membershipId: string) => {
    const membership = configuration.groupMemberships.find(
      (item) => item.id === membershipId,
    );
    const firstWeekHours = membership?.weeklyTargetHoursByWeek[0] ?? 0;
    if (firstWeekHours <= 0) return;
    setConfiguration({
      ...configuration,
      groupMemberships: configuration.groupMemberships.map((item) =>
        item.id === membershipId
          ? {
              ...item,
              weeklyTargetHoursByWeek: Array(
                configuration.planningHorizonWeeks,
              ).fill(firstWeekHours),
            }
          : item,
      ),
    });
  };

  const addGlobalEducator = () => {
    const educatorId = `EDU-${crypto.randomUUID()}`;
    setConfiguration({
      ...configuration,
      educators: [
        ...configuration.educators,
        {
          id: educatorId,
          groupId: null,
          displayName: "Nowy wychowawca",
          shortCode: `W${configuration.educators.length + 1}`,
          baseWeeklyAssignedMinutes: 0,
          description: "",
          active: true,
          canWorkWeekends: true,
        },
      ],
    });
    setSelectedEducatorId(educatorId);
  };

  const addMembership = () => {
    const educatorId = selectedEducatorId || available[0]?.id;
    if (!educatorId || memberships.length >= 4) return;
    setConfiguration({
      ...configuration,
      educatorCount: (memberships.length === 3 ? 4 : 3) as 3 | 4,
      groupMemberships: [
        ...configuration.groupMemberships,
        {
          id: crypto.randomUUID(),
          groupId: activeGroup.id,
          educatorId,
          role: memberships.length < 3 ? "PRIMARY" : "SUPPORT",
          active: true,
          weeklyTargetHoursByWeek: Array(configuration.planningHorizonWeeks).fill(0),
          fixedPartialSchedule: false,
          description: "",
        },
      ],
    });
    setSelectedEducatorId("");
  };

  const removeMembership = (membershipId: string) => {
    if (memberships.length <= 3) return;
    if (!window.confirm("Usunąć członkostwo tej osoby w aktywnej grupie? Dane osoby pozostaną w rejestrze globalnym.")) return;
    setConfiguration({
      ...configuration,
      educatorCount: 3,
      groupMemberships: configuration.groupMemberships.filter((item) => item.id !== membershipId),
    });
  };

  const saveRecurringNights = (nights: RecurringNightDuty[]) => {
    setConfiguration(replaceRecurringNights(configuration, nights));
  };

  const repairNightTotal = (membershipId: string) => {
    const membership = configuration.groupMemberships.find(m => m.id === membershipId)!;
    const totals = Array.from({length: configuration.planningHorizonWeeks}, (_, w) =>
      (membership.weeklyTargetHoursByWeek[w] ?? membership.weeklyTargetHoursByWeek.at(-1) ?? 0) - fixedNightHours(configuration, membership, w));
    if (totals.some((total,w) => total < fixedNightHours(configuration,membership,w))) {
      setNightMessage("Nie zmieniono godzin: po tej korekcie wymiar byłby mniejszy niż same nocki. Wpisz właściwy łączny wymiar ręcznie."); return;
    }
    const name = educatorById.get(membership.educatorId)?.displayName ?? "wychowawcy";
    const preview = totals.map((total,w) => `Tydzień ${w+1}: łącznie ${formatPolishHours(total)} godz., w tym nocki ${formatPolishHours(fixedNightHours(configuration,membership,w))} godz.; opieka ${formatPolishHours(total-fixedNightHours(configuration,membership,w))} godz.`).join("\n");
    if (!window.confirm(`Korekta tylko dla ${name}. Użyj wyłącznie, jeśli starsza wersja omyłkowo dodała nocki ponad Twój wymiar.\n${preview}\nNocki, dostępność i godziny innych osób pozostaną bez zmian. Zatwierdzić?`)) return;
    try { localStorage.setItem("harmonogram-before-night-budget-repair-v1", JSON.stringify({configuration,savedAt:new Date().toISOString()})); }
    catch { setNightMessage("Nie zmieniono godzin: brak miejsca na kopię. Najpierw pobierz projekt."); return; }
    setConfiguration({...configuration,groupMemberships:configuration.groupMemberships.map(m => m.id===membershipId
      ? {...m,hoursIncludeFixedNights:true,weeklyTargetHoursByWeek:totals} : m)});
    setNightMessage("Skorygowano wyłącznie wskazany wymiar. Stałe nocki są częścią sumy, nie dodatkiem. Kopia poprzednich danych została zachowana.");
  };

  const addRecurringNight = () => {
    if (!recurringNight.educatorId) return;
    const recurringNightDuties = configuration.recurringNightDuties ?? [];
    if (
      recurringNightDuties.some(
        (item) =>
          item.educatorId === recurringNight.educatorId &&
          item.startDayOfWeek === recurringNight.startDayOfWeek,
      )
    ) {
      setNightMessage("Ta stała nocka jest już wpisana.");
      return;
    }
    const item: RecurringNightDuty = {
      id: crypto.randomUUID(),
      educatorId: recurringNight.educatorId,
      startDayOfWeek: recurringNight.startDayOfWeek,
      budgetGroupId: activeGroup.id,
      description: "Stała nocka 22:00–06:00, powtarzana co tydzień.",
    };
    saveRecurringNights([...recurringNightDuties, item]);
    setRecurringNight({ ...recurringNight, educatorId: "" });
    setNightMessage("Nocka zajmuje oba dni i wykorzystuje 8 godzin z wpisanego wymiaru. Łączny wymiar nie zmienił się; opieka na grupie zmniejszyła się o 8 godzin tygodniowo.");
  };

  const addAdditionalNight = () => {
    if (!additionalNight.educatorId || !additionalNight.startDate) return;
    try {
      const item = createNightAssignment({
        id: crypto.randomUUID(),
        educatorId: additionalNight.educatorId,
        startDate: additionalNight.startDate,
        startTime: additionalNight.startTime,
        endTime: additionalNight.endTime,
        timeZoneId: configuration.timeZoneId,
        description:
          additionalNight.description || "Dodatkowa nocka / nadgodziny.",
      });
      setConfiguration({
        ...configuration,
        externalDutyAssignments: [...configuration.externalDutyAssignments, item],
      });
      setAdditionalNight({
        educatorId: "",
        startDate: "",
        startTime: NIGHT_START_TIME,
        endTime: NIGHT_END_TIME,
        description: "",
      });
      setNightMessage("Dodatkowa nocka została dodana tylko w wybranym terminie.");
    } catch (caught) {
      setNightMessage(
        caught instanceof Error ? caught.message : "Nie udało się dodać nocki.",
      );
    }
  };

  const addUnavailability = () => {
    if (!unavailable.educatorId) return;
    const item: Unavailability = {
      id: crypto.randomUUID(),
      educatorId: unavailable.educatorId,
      type: unavailable.type,
      scope: "RECURRING_WEEKLY",
      dayOfWeek: unavailable.dayOfWeek,
      weekNumber: null,
      date: null,
      startTime: unavailable.startTime,
      endTime: unavailable.endTime,
      description: unavailable.description,
    };
    setConfiguration({ ...configuration, unavailability: [...configuration.unavailability, item] });
  };

  return (
    <SectionTiles>
      <PageHeader
        eyebrow="KROK 03 · GLOBALNY REJESTR"
        title="Wychowawcy internatu"
        description={`Edytujesz członkostwa grupy ${activeGroup.code} · ${activeGroup.name}. Jedna osoba może należeć do kilku grup.`}
        actions={<button className="button button--secondary" type="button" onClick={addGlobalEducator}>Dodaj osobę do rejestru</button>}
      />

      <section className="section-block" id="godziny">
        <div className="section-heading">
          <div><span className="eyebrow">AKTYWNA GRUPA</span><h2>Godziny opieki · {memberships.length} osoby</h2></div>
          <div className="section-heading__actions">
            <StatusBadge value={memberships.length >= 3 && memberships.length <= 4 ? "KOMPLET" : "UZUPEŁNIJ"} />
            <button
              className="button button--secondary"
              type="button"
              disabled={busy}
              onClick={() => void validateInput()}
            >
              {busy ? "Sprawdzanie…" : "Sprawdź sumy godzin"}
            </button>
          </div>
        </div>
        <div
          className={`inline-guidance ${incompleteHourMemberships.length || mismatchedWeeks.size ? "inline-guidance--error" : "inline-guidance--ok"}`}
          role="status"
        >
          <span aria-hidden="true">{incompleteHourMemberships.length || mismatchedWeeks.size ? "!" : "✓"}</span>
          <div>
            <strong>
              {incompleteHourMemberships.length
                ? `Uzupełnij godziny dla ${incompleteHourMemberships.length} osób`
                : mismatchedWeeks.size
                  ? `Suma nie zgadza się w ${mismatchedWeeks.size} ${mismatchedWeeks.size === 1 ? "tygodniu" : "tygodniach"}`
                  : inputReport
                    ? "Suma godzin zgadza się z planem opieki"
                    : "Godziny są wpisane — sprawdź ich sumę"}
            </strong>
            <p>
              Wpisuj łączny wymiar: opieka + stałe nocki. Poniżej pola widać podział.
              Nocka zajmuje 8 godzin wymiaru i oba dni kalendarzowe. Suma z planem pobytu porównuje tylko opiekę dzienną.
            </p>
          </div>
        </div>
        <div className="week-balance-grid" aria-label="Suma godzin według tygodni">
          {Array.from({ length: configuration.planningHorizonWeeks }, (_, weekIndex) => {
            const weekNumber = weekIndex + 1;
            const balance = balanceByWeek.get(weekNumber);
            const difference = balance?.differenceMinutes ?? null;
            const isMismatch = difference !== null && difference !== 0;
            const direction = difference !== null && difference < 0 ? "brakuje" : "za dużo";
            return (
              <article
                className={`week-balance ${isMismatch ? "week-balance--error" : balance ? "week-balance--ok" : ""}`}
                id={`godziny-tydzien-${weekNumber}`}
                key={weekNumber}
              >
                <div>
                  <span>Tydzień {weekNumber}</span>
                  <strong>
                    {isMismatch
                      ? `${direction} ${formatMinutes(Math.abs(difference))}`
                      : balance
                        ? "Suma się zgadza"
                        : `Wpisano ${formatMinutes(enteredMinutesByWeek[weekIndex])}`}
                  </strong>
                </div>
                {balance ? (
                  <p>
                    Plan wymaga <strong>{formatMinutes(balance.requiredMinutes)}</strong>,
                    wpisano <strong>{formatMinutes(balance.assignedMinutes)}</strong>
                    {isMismatch && (
                      <> — {difference < 0 ? "zwiększ" : "zmniejsz"} sumę pól tego tygodnia o <strong>{formatMinutes(Math.abs(difference))}</strong></>
                    )}
                  </p>
                ) : (
                  <p>Wybierz „Sprawdź sumy godzin”, aby porównać je z planem opieki.</p>
                )}
              </article>
            );
          })}
        </div>
        <div className="educator-grid">
          {memberships.map((membership, index) => {
            const educator = educatorById.get(membership.educatorId)!;
            return (
              <article
                className="person-card"
                id={`godziny-${educator.id}`}
                key={membership.id}
              >
                <div className={`avatar avatar--${(index % 4) + 1}`}>{educator.shortCode}</div>
                <div className="person-card__title"><span>{membership.role === "PRIMARY" ? "Podstawowy" : "Uzupełniający"}</span><StatusBadge value={membership.role} /></div>
                <label>Imię i nazwisko<input value={educator.displayName} onChange={(event) => updateEducator(educator.id, "displayName", event.target.value)} /></label>
                <label>Skrót<input value={educator.shortCode} onChange={(event) => updateEducator(educator.id, "shortCode", event.target.value)} /></label>
                <label className="check-field"><input type="checkbox" checked={!!educator.preferSingleDailyVisit}
                  onChange={event=>setConfiguration({...configuration,educators:configuration.educators.map(e=>e.id===educator.id?{...e,preferSingleDailyVisit:event.target.checked}:e)})}/>
                  Preferuj jeden przyjazd dziennie</label>
                <details className="rule-hint"><summary>Jak ograniczamy dojazdy?</summary><p>Generator stara się łączyć dyżury tej osoby w jeden ciągły blok, wspólnie we wszystkich dołączonych grupach. Dodatkowy odcinek ma trzykrotnie większy koszt niż u osoby bez tej preferencji. Nie jest to zakaz dwóch dyżurów: wymagane godziny, odpoczynki i stałe wpisy mają pierwszeństwo. Praca poza internatem nie jest traktowana jako dojazd do internatu.</p></details>
                <label>
                  Rola w tej grupie
                  <select
                    aria-label={`Rola ${educator.displayName}`}
                    value={membership.role}
                    onChange={(event) => {
                      const role = event.target.value as "PRIMARY" | "SUPPORT";
                      updateMembership(membership.id, {
                        role,
                        fixedPartialSchedule:
                          role === "SUPPORT"
                            ? membership.fixedPartialSchedule
                            : false,
                      });
                    }}
                  >
                    <option value="PRIMARY">Stały — dokładnie 5 dni</option>
                    <option value="SUPPORT">Pomocniczy / dochodzący</option>
                  </select>
                </label>
                {membership.role === "SUPPORT" && (
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={membership.fixedPartialSchedule ?? false}
                      onChange={(event) =>
                        updateMembership(membership.id, {
                          fixedPartialSchedule: event.target.checked,
                        })
                      }
                    />
                    <span>
                      <strong>Stały plan pomocniczy</strong>
                      <small>
                        Pracuje także poza tą grupą. Tutaj może mieć 1–5 dni,
                        ale wszystkie jego godziny wpisz niżej jako obowiązkowe
                        dyżury co tydzień.
                      </small>
                    </span>
                  </label>
                )}
                {Array.from({ length: configuration.planningHorizonWeeks }, (_, weekIndex) => (
                  <label
                    className={`${
                      (membership.weeklyTargetHoursByWeek[weekIndex] ??
                        membership.weeklyTargetHoursByWeek.at(-1) ??
                        0) <= 0
                        ? "field-warning"
                        : ""
                    } ${mismatchedWeeks.has(weekIndex + 1) ? "field-balance-error" : ""}`.trim()}
                    key={weekIndex}
                  >
                    Łącznie: opieka + stałe nocki{configuration.planningHorizonWeeks > 1 ? ` · tydzień ${weekIndex + 1}` : ""}
                    <input
                      key={`${membership.id}-${weekIndex}-${membership.weeklyTargetHoursByWeek[weekIndex]}`}
                      inputMode="decimal"
                      aria-invalid={
                        (membership.weeklyTargetHoursByWeek[weekIndex] ??
                          membership.weeklyTargetHoursByWeek.at(-1) ??
                          0) <= 0 || mismatchedWeeks.has(weekIndex + 1)
                      }
                      aria-describedby={mismatchedWeeks.has(weekIndex + 1) ? `godziny-tydzien-${weekIndex + 1}` : undefined}
                      defaultValue={formatPolishHours(membership.weeklyTargetHoursByWeek[weekIndex] ?? membership.weeklyTargetHoursByWeek.at(-1) ?? 0)}
                      onBlur={(event) => updateHours(membership.id, weekIndex, event.target.value)}
                    />
                    <small>Opieka: {formatPolishHours(careHours(configuration, membership, weekIndex))} godz. + stałe nocki: {formatPolishHours(fixedNightHours(configuration, membership, weekIndex))} godz.</small>
                    {(membership.weeklyTargetHoursByWeek[weekIndex] ??
                      membership.weeklyTargetHoursByWeek.at(-1) ??
                      0) <= 0 && <small>Wpisz więcej niż 0 godzin.</small>}
                  </label>
                ))}
                {configuration.planningHorizonWeeks > 1 && (
                  <button
                    className="button button--ghost person-card__copy-hours"
                    type="button"
                    disabled={(membership.weeklyTargetHoursByWeek[0] ?? 0) <= 0}
                    onClick={() => copyFirstWeekToAll(membership.id)}
                  >
                    Skopiuj tydzień 1 do pozostałych
                  </button>
                )}
                {fixedNightHours(configuration, membership, 0) > 0 && <details className="person-card__more">
                  <summary>Starsza wersja doliczyła nockę ponad wymiar?</summary>
                  <p>Stała nocka jest już w sumie. Przykład: 28,5 godz. łącznie = 20,5 godz. opieki + 8 godz. nocki. Jeśli starsza wersja zmieniła 28,5 na 36,5, użyj korekty. Najpierw zobaczysz nowe wartości do zatwierdzenia.</p>
                  <button className="button button--ghost" type="button" disabled={busy} onClick={() => repairNightTotal(membership.id)}>Popraw wymiar zawyżony o nocki</button>
                </details>}
                <details className="person-card__more">
                  <summary>Więcej ustawień osoby</summary>
                  <label>Opis<textarea value={educator.description} onChange={(event) => updateEducator(educator.id, "description", event.target.value)} /></label>
                  {memberships.length === 4 && <button className="button button--ghost" type="button" onClick={() => removeMembership(membership.id)}>Usuń z tej grupy</button>}
                </details>
              </article>
            );
          })}
        </div>
        {memberships.length < 4 && (
          <>
            <p>Osoba pozostająca tylko w rejestrze, bez członkostwa ani dyżurów, nie jest wymagana do wygenerowania planu. Jej danych nie trzeba kasować.</p>
            <div className="inline-form">
              <label>Osoba z rejestru<select value={selectedEducatorId} onChange={(event) => setSelectedEducatorId(event.target.value)}><option value="">Wybierz</option>{available.map((item) => <option key={item.id} value={item.id}>{item.displayName} · {item.shortCode}</option>)}</select></label>
              <button className="button button--secondary" type="button" disabled={!available.length} onClick={addMembership}>Dodaj do grupy</button>
            </div>
          </>
        )}
      </section>

      <WorkCommitments />

      <section className="section-block" id="dostepnosc">
        <div className="section-heading"><div><span className="eyebrow">KIEDY NIE MOŻE PRACOWAĆ</span><h2>Niedostępność wychowawcy</h2></div></div>
        <div className="inline-form">
          <label>Wychowawca<select value={unavailable.educatorId} onChange={(event) => setUnavailable({ ...unavailable, educatorId: event.target.value })}><option value="">Wybierz</option>{configuration.educators.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
          <label>Rodzaj<select value={unavailable.type} onChange={(event) => setUnavailable({ ...unavailable, type: event.target.value as "HARD" | "PREFERRED" })}><option value="HARD">Nie może pracować</option><option value="PREFERRED">Woli nie pracować</option></select></label>
          <label>Dzień<select value={unavailable.dayOfWeek} onChange={(event) => setUnavailable({ ...unavailable, dayOfWeek: Number(event.target.value) })}>{["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Niedz"].map((name, index) => <option key={name} value={index}>{name}</option>)}</select></label>
          <label>Od<input type="time" step="1800" value={unavailable.startTime} onChange={(event) => setUnavailable({ ...unavailable, startTime: event.target.value })} /></label>
          <label>Do<input type="time" step="1800" value={unavailable.endTime} onChange={(event) => setUnavailable({ ...unavailable, endTime: event.target.value })} /></label>
          <button className="button button--secondary" type="button" onClick={addUnavailability}>Dodaj</button>
        </div>
        <div className="record-list">{configuration.unavailability.map((item) => <div className="record-row" key={item.id}><span>{educatorById.get(item.educatorId)?.shortCode}</span><strong>{item.type === "HARD" ? "Nie może pracować" : "Woli nie pracować"} · {item.startTime}–{item.endTime}</strong><button className="icon-button" type="button" onClick={() => setConfiguration({ ...configuration, unavailability: configuration.unavailability.filter((value) => value.id !== item.id) })}>×</button></div>)}</div>
      </section>

      <section className="section-block" id="nocki">
        <div className="section-heading"><div><span className="eyebrow">NOC 22:00–06:00</span><h2>Nocki stałe i dodatkowe</h2></div></div>
        <div className="inline-guidance inline-guidance--ok" role="status">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>Przy stałej nocce wybierasz tylko osobę i dzień</strong>
            <p>Aplikacja przyjmie 22:00–06:00 następnego dnia w każdym tygodniu. Te 8 godzin odejmuje od wpisanego łącznego wymiaru, nie dodaje ich ponad wymiar. Np. 28,5 godz. łącznie oznacza 20,5 godz. opieki i 8 godz. nocki.</p>
          </div>
        </div>

        <div className="duty-mode-grid">
          <article className="duty-mode-card">
            <span className="eyebrow">STAŁA NOCKA · CO TYDZIEŃ</span>
            <h3>Dodaj raz — obowiązuje do usunięcia</h3>
            <div className="inline-form">
              <label>Wychowawca<select aria-label="Wychowawca stałej nocki" value={recurringNight.educatorId} onChange={(event) => setRecurringNight({ ...recurringNight, educatorId: event.target.value })}><option value="">Wybierz</option>{configuration.educators.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
              <label>Dzień rozpoczęcia<select aria-label="Dzień rozpoczęcia stałej nocki" value={recurringNight.startDayOfWeek} onChange={(event) => setRecurringNight({ ...recurringNight, startDayOfWeek: Number(event.target.value) })}>{WEEKDAY_NAMES.map((name, index) => <option key={name} value={index}>{name}</option>)}</select></label>
              <div className="fixed-night-hours"><small>Godziny ustawione automatycznie</small><strong>22:00 → 06:00 następnego dnia</strong></div>
              <button className="button button--primary" type="button" disabled={!recurringNight.educatorId} onClick={addRecurringNight}>Dodaj stałą nockę</button>
            </div>
            <div className="record-list">{(configuration.recurringNightDuties ?? []).map((item) => <div className="record-row" key={item.id}>
              <span>{educatorById.get(item.educatorId)?.shortCode}</span>
              <strong>{educatorById.get(item.educatorId)?.displayName} · {recurringNightLabel(item.startDayOfWeek)} · dwa dni pracy · co tydzień</strong>
              <label>8 godzin w grupie<select aria-label={`Grupa stałej nocki ${educatorById.get(item.educatorId)?.displayName}`} value={item.budgetGroupId ?? ""} onChange={e => saveRecurringNights((configuration.recurringNightDuties ?? []).map(d => d.id === item.id ? { ...d, budgetGroupId: e.target.value } : d))}>
                <option value="">Wybierz grupę</option>{configuration.groups.filter(g => g.active && configuration.groupMemberships.some(m => m.active && m.groupId === g.id && m.educatorId === item.educatorId)).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select></label>
              <button className="icon-button" type="button" aria-label={`Usuń stałą nockę ${educatorById.get(item.educatorId)?.displayName ?? "wychowawcy"}`} onClick={() => saveRecurringNights((configuration.recurringNightDuties ?? []).filter(value => value.id !== item.id))}>×</button>
            </div>)}</div>
          </article>

          <article className="duty-mode-card duty-mode-card--additional">
            <span className="eyebrow">DODATKOWA NOCKA / NADGODZINY</span>
            <h3>Jedna konkretna data</h3>
            <p className="section-copy">Domyślnie 22:00–06:00. Godziny zmień tylko wtedy, gdy wychowawca ma przyjść wcześniej lub skończyć inaczej.</p>
            <div className="inline-form">
              <label>Wychowawca<select aria-label="Wychowawca dodatkowej nocki" value={additionalNight.educatorId} onChange={(event) => setAdditionalNight({ ...additionalNight, educatorId: event.target.value })}><option value="">Wybierz</option>{configuration.educators.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
              <label>Data rozpoczęcia<input aria-label="Data rozpoczęcia dodatkowej nocki" type="date" value={additionalNight.startDate} onChange={(event) => setAdditionalNight({ ...additionalNight, startDate: event.target.value })} /></label>
              <label>Od<input aria-label="Początek dodatkowej nocki" type="time" step="1800" value={additionalNight.startTime} onChange={(event) => setAdditionalNight({ ...additionalNight, startTime: event.target.value })} /></label>
              <label>Do następnego dnia<input aria-label="Koniec dodatkowej nocki" type="time" step="1800" value={additionalNight.endTime} onChange={(event) => setAdditionalNight({ ...additionalNight, endTime: event.target.value })} /></label>
              <button className="button button--secondary" type="button" disabled={!additionalNight.educatorId || !additionalNight.startDate} onClick={addAdditionalNight}>Dodaj tylko ten dyżur</button>
            </div>
            <div className="record-list">{configuration.externalDutyAssignments.filter((item) => item.dutyType === "NIGHT").map((item) => <div className="record-row" key={item.id}><span>{educatorById.get(item.educatorId)?.shortCode}</span><strong>{educatorById.get(item.educatorId)?.displayName} · {formatNightDateTime(item.startDateTime, configuration.timeZoneId)}–{formatNightDateTime(item.endDateTime, configuration.timeZoneId)}</strong><button className="icon-button" type="button" aria-label={`Usuń dodatkową nockę ${educatorById.get(item.educatorId)?.displayName ?? "wychowawcy"}`} onClick={() => setConfiguration({ ...configuration, externalDutyAssignments: configuration.externalDutyAssignments.filter((value) => value.id !== item.id) })}>×</button></div>)}</div>
          </article>
        </div>
        {nightMessage && <p className="form-message" role="status">{nightMessage}</p>}
      </section>
    </SectionTiles>
  );
}
