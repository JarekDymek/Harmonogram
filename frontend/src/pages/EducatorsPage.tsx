import { useMemo, useState } from "react";
import { EmptyState, PageHeader, StatusBadge, formatMinutes } from "../components/UI";
import { useAppState } from "../state/AppState";
import { formatPolishHours, parsePolishHours } from "../time";
import {
  NIGHT_END_TIME,
  NIGHT_START_TIME,
  WEEKDAY_NAMES,
  createNightAssignment,
  formatNightDateTime,
  recurringNightLabel,
} from "../nightDuties";
import type { RecurringNightDuty, Unavailability } from "../types";

export function EducatorsPage() {
  const { configuration, generation, setConfiguration } = useAppState();
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
      description: "Stała nocka 22:00–06:00, powtarzana co tydzień.",
    };
    setConfiguration({
      ...configuration,
      recurringNightDuties: [...recurringNightDuties, item],
    });
    setRecurringNight({ ...recurringNight, educatorId: "" });
    setNightMessage("Stała nocka została dodana do każdego tygodnia planu.");
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

  const globalTotals = configuration.educators.map((educator) => {
    const target = configuration.groupMemberships
      .filter((item) => item.active && item.educatorId === educator.id)
      .reduce((sum, item) => sum + (item.weeklyTargetHoursByWeek[0] ?? 0) * 60, 0);
    const actual = generation?.assignments
      .filter((item) => item.educatorId === educator.id)
      .reduce((sum, item) => sum + item.endMinute - item.startMinute, 0) ?? 0;
    return { educator, target, actual };
  });

  return (
    <>
      <PageHeader
        eyebrow="KROK 03 · GLOBALNY REJESTR"
        title="Wychowawcy internatu"
        description={`Edytujesz członkostwa grupy ${activeGroup.code} · ${activeGroup.name}. Jedna osoba może należeć do kilku grup.`}
        actions={<button className="button button--secondary" type="button" onClick={addGlobalEducator}>Dodaj osobę do rejestru</button>}
      />

      <section className="section-block" id="godziny">
        <div className="section-heading"><div><span className="eyebrow">AKTYWNA GRUPA</span><h2>{memberships.length} członkostwa</h2></div><StatusBadge value={memberships.length >= 3 && memberships.length <= 4 ? "KOMPLET" : "UZUPEŁNIJ"} /></div>
        <div
          className={`inline-guidance ${incompleteHourMemberships.length ? "inline-guidance--warning" : "inline-guidance--ok"}`}
          role="status"
        >
          <span aria-hidden="true">{incompleteHourMemberships.length ? "!" : "✓"}</span>
          <div>
            <strong>
              {incompleteHourMemberships.length
                ? `Uzupełnij godziny dla ${incompleteHourMemberships.length} osób`
                : "Wymiar godzin jest uzupełniony"}
            </strong>
            <p>
              W każdym tygodniu wpisz liczbę większą niż 0, np. 30 albo 30,5.
              Wartość zapisze się automatycznie po opuszczeniu pola.
            </p>
          </div>
        </div>
        <div className="educator-grid">
          {memberships.map((membership, index) => {
            const educator = educatorById.get(membership.educatorId)!;
            return (
              <article className="person-card" key={membership.id}>
                <div className={`avatar avatar--${(index % 4) + 1}`}>{educator.shortCode}</div>
                <div className="person-card__title"><span>{membership.role === "PRIMARY" ? "Podstawowy" : "Uzupełniający"}</span><StatusBadge value={membership.role} /></div>
                <label>Imię i nazwisko<input value={educator.displayName} onChange={(event) => updateEducator(educator.id, "displayName", event.target.value)} /></label>
                <label>Skrót<input value={educator.shortCode} onChange={(event) => updateEducator(educator.id, "shortCode", event.target.value)} /></label>
                {Array.from({ length: configuration.planningHorizonWeeks }, (_, weekIndex) => (
                  <label
                    className={
                      (membership.weeklyTargetHoursByWeek[weekIndex] ??
                        membership.weeklyTargetHoursByWeek.at(-1) ??
                        0) <= 0
                        ? "field-warning"
                        : ""
                    }
                    key={weekIndex}
                  >
                    Godziny tygodniowo{configuration.planningHorizonWeeks > 1 ? ` · tydzień ${weekIndex + 1}` : ""}
                    <input
                      inputMode="decimal"
                      aria-invalid={
                        (membership.weeklyTargetHoursByWeek[weekIndex] ??
                          membership.weeklyTargetHoursByWeek.at(-1) ??
                          0) <= 0
                      }
                      defaultValue={formatPolishHours(membership.weeklyTargetHoursByWeek[weekIndex] ?? membership.weeklyTargetHoursByWeek.at(-1) ?? 0)}
                      onBlur={(event) => updateHours(membership.id, weekIndex, event.target.value)}
                    />
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
                <label>Opis<textarea value={educator.description} onChange={(event) => updateEducator(educator.id, "description", event.target.value)} /></label>
                {memberships.length === 4 && <button className="button button--ghost" type="button" onClick={() => removeMembership(membership.id)}>Usuń członkostwo</button>}
              </article>
            );
          })}
        </div>
        {memberships.length < 4 && (
          <div className="inline-form">
            <label>Osoba z rejestru<select value={selectedEducatorId} onChange={(event) => setSelectedEducatorId(event.target.value)}><option value="">Wybierz</option>{available.map((item) => <option key={item.id} value={item.id}>{item.displayName} · {item.shortCode}</option>)}</select></label>
            <button className="button button--secondary" type="button" disabled={!available.length} onClick={addMembership}>Dodaj do grupy</button>
          </div>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading"><div><span className="eyebrow">WSZYSTKIE GRUPY</span><h2>Globalne podsumowanie godzin</h2></div></div>
        <div className="metric-grid metric-grid--three">
          {globalTotals.map(({ educator, target, actual }) => (
            <div className="metric" key={educator.id}><small>{educator.displayName}</small><strong>{formatMinutes(target)}</strong><span>cel grup · wynik {formatMinutes(actual)}</span></div>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><span className="eyebrow">OGRANICZENIA GLOBALNE</span><h2>Niedostępności</h2></div></div>
        <div className="inline-form">
          <label>Wychowawca<select value={unavailable.educatorId} onChange={(event) => setUnavailable({ ...unavailable, educatorId: event.target.value })}><option value="">Wybierz</option>{configuration.educators.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
          <label>Rodzaj<select value={unavailable.type} onChange={(event) => setUnavailable({ ...unavailable, type: event.target.value as "HARD" | "PREFERRED" })}><option value="HARD">HARD</option><option value="PREFERRED">PREFERRED</option></select></label>
          <label>Dzień<select value={unavailable.dayOfWeek} onChange={(event) => setUnavailable({ ...unavailable, dayOfWeek: Number(event.target.value) })}>{["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Niedz"].map((name, index) => <option key={name} value={index}>{name}</option>)}</select></label>
          <label>Od<input type="time" step="1800" value={unavailable.startTime} onChange={(event) => setUnavailable({ ...unavailable, startTime: event.target.value })} /></label>
          <label>Do<input type="time" step="1800" value={unavailable.endTime} onChange={(event) => setUnavailable({ ...unavailable, endTime: event.target.value })} /></label>
          <button className="button button--secondary" type="button" onClick={addUnavailability}>Dodaj</button>
        </div>
        <div className="record-list">{configuration.unavailability.map((item) => <div className="record-row" key={item.id}><span>{educatorById.get(item.educatorId)?.shortCode}</span><strong>{item.type} · {item.startTime}–{item.endTime}</strong><button className="icon-button" type="button" onClick={() => setConfiguration({ ...configuration, unavailability: configuration.unavailability.filter((value) => value.id !== item.id) })}>×</button></div>)}</div>
      </section>

      <section className="section-block" id="nocki">
        <div className="section-heading"><div><span className="eyebrow">NOC 22:00–06:00</span><h2>Nocki stałe i dodatkowe</h2></div></div>
        <div className="inline-guidance inline-guidance--ok" role="status">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>Przy stałej nocce wybierasz tylko osobę i dzień</strong>
            <p>Aplikacja sama przyjmie pracę od 22:00 do 06:00 następnego dnia i powtórzy ją w każdym tygodniu planu.</p>
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
            <div className="record-list">{(configuration.recurringNightDuties ?? []).map((item) => <div className="record-row" key={item.id}><span>{educatorById.get(item.educatorId)?.shortCode}</span><strong>{educatorById.get(item.educatorId)?.displayName} · {recurringNightLabel(item.startDayOfWeek)} · co tydzień</strong><button className="icon-button" type="button" aria-label={`Usuń stałą nockę ${educatorById.get(item.educatorId)?.displayName ?? "wychowawcy"}`} onClick={() => setConfiguration({ ...configuration, recurringNightDuties: (configuration.recurringNightDuties ?? []).filter((value) => value.id !== item.id) })}>×</button></div>)}</div>
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
    </>
  );
}
