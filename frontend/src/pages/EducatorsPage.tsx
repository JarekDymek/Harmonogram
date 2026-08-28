import { useMemo, useState } from "react";
import { EmptyState, PageHeader, StatusBadge, formatMinutes } from "../components/UI";
import { useAppState } from "../state/AppState";
import { formatPolishHours, parsePolishHours } from "../time";
import type { ExternalDutyAssignment, Unavailability } from "../types";

export function EducatorsPage() {
  const { configuration, generation, setConfiguration } = useAppState();
  const [selectedEducatorId, setSelectedEducatorId] = useState("");
  const [night, setNight] = useState({ educatorId: "", startDateTime: "", endDateTime: "", description: "" });
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

  const addNightDuty = () => {
    if (!night.educatorId || !night.startDateTime || !night.endDateTime) return;
    const item: ExternalDutyAssignment = {
      id: crypto.randomUUID(),
      educatorId: night.educatorId,
      startDateTime: new Date(night.startDateTime).toISOString(),
      endDateTime: new Date(night.endDateTime).toISOString(),
      dutyType: "NIGHT",
      locked: true,
      countsTowardsHours: false,
      description: night.description,
    };
    setConfiguration({
      ...configuration,
      externalDutyAssignments: [...configuration.externalDutyAssignments, item],
    });
    setNight({ educatorId: "", startDateTime: "", endDateTime: "", description: "" });
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

      <section className="section-block">
        <div className="section-heading"><div><span className="eyebrow">ZABLOKOWANE ZAJĘCIA</span><h2>Dyżury nocne</h2></div></div>
        <div className="inline-form">
          <label>Wychowawca<select value={night.educatorId} onChange={(event) => setNight({ ...night, educatorId: event.target.value })}><option value="">Wybierz</option>{configuration.educators.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
          <label>Początek<input type="datetime-local" value={night.startDateTime} onChange={(event) => setNight({ ...night, startDateTime: event.target.value })} /></label>
          <label>Koniec<input type="datetime-local" value={night.endDateTime} onChange={(event) => setNight({ ...night, endDateTime: event.target.value })} /></label>
          <button className="button button--secondary" type="button" onClick={addNightDuty}>Dodaj dyżur</button>
        </div>
        <div className="record-list">{configuration.externalDutyAssignments.map((item) => <div className="record-row" key={item.id}><span>{educatorById.get(item.educatorId)?.shortCode}</span><strong>{item.dutyType} · {item.startDateTime.replace("T", " ").slice(0, 16)}–{item.endDateTime.replace("T", " ").slice(0, 16)}</strong><button className="icon-button" type="button" onClick={() => setConfiguration({ ...configuration, externalDutyAssignments: configuration.externalDutyAssignments.filter((value) => value.id !== item.id) })}>×</button></div>)}</div>
      </section>
    </>
  );
}
