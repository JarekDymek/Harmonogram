import { useMemo, useState } from "react";
import { DAY_NAMES, EmptyState, MessagesTable, PageHeader, StatusBadge, formatMinutes, minutesToTime } from "../components/UI";
import { useAppState } from "../state/AppState";
import { isValidatedPlan } from "../generation";

function educatorColor(educatorId: string) {
  let hash = 0;
  for (const character of educatorId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 58% 88%)`;
}

export function InternatPage() {
  const { configuration, generation } = useAppState();
  const [week, setWeek] = useState(1);
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
  const groups = configuration.groups
    .filter((item) => item.active)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const assignments = isValidatedPlan(generation) ? generation.assignments.filter((item) => weekDates.includes(item.date)) : [];
  const educatorById = new Map(configuration.educators.map((item) => [item.id, item]));

  return (
    <>
      <PageHeader
        eyebrow="WIDOK GLOBALNY"
        title="Cały internat"
        description="Wiersze odpowiadają grupom, a kolumny dniom. Ta sama osoba zachowuje kolor i identyfikator we wszystkich grupach."
      />
      <div className="week-tabs" aria-label="Wybór tygodnia">
        {Array.from({ length: configuration.planningHorizonWeeks }, (_, index) => index + 1).map((value) => (
          <button key={value} type="button" className={week === value ? "active" : ""} onClick={() => setWeek(value)}>
            Tydzień {value}
          </button>
        ))}
      </div>
      {!isValidatedPlan(generation) ? (
        <EmptyState>Wygeneruj harmonogram, aby zobaczyć wspólną tabelę internatu.</EmptyState>
      ) : (
        <section className="internat-table-wrap">
          <table className="internat-table">
            <thead>
              <tr>
                <th>Grupa</th>
                {weekDates.map((date, index) => <th key={date}>{DAY_NAMES[index]}<small>{date.slice(8, 10)}.{date.slice(5, 7)}</small></th>)}
                <th>Godziny w grupie</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const groupAssignments = assignments.filter((item) => item.groupId === group.id);
                const totals = new Map<string, number>();
                groupAssignments.forEach((item) => totals.set(item.educatorId, (totals.get(item.educatorId) ?? 0) + item.endMinute - item.startMinute));
                return (
                  <tr key={group.id}>
                    <th><strong>{group.code}</strong><span>{group.name}</span><small>{group.classLabel}</small></th>
                    {weekDates.map((date) => (
                      <td key={date}>
                        {groupAssignments
                          .filter((item) => item.date === date)
                          .sort((a, b) => a.startMinute - b.startMinute)
                          .map((item) => {
                            const educator = educatorById.get(item.educatorId);
                            return (
                              <div className="internat-shift" style={{ backgroundColor: educatorColor(item.educatorId) }} key={`${item.educatorId}-${item.startMinute}`}>
                                <strong>{minutesToTime(item.startMinute)}–{minutesToTime(item.endMinute)}</strong>
                                <span>{educator?.shortCode ?? item.educatorId}</span>
                                <small>{educator?.displayName}</small>
                              </div>
                            );
                          })}
                      </td>
                    ))}
                    <td className="internat-summary">
                      {[...totals.entries()].map(([educatorId, minutes]) => (
                        <div key={educatorId}><span>{educatorById.get(educatorId)?.shortCode ?? educatorId}</span><strong>{formatMinutes(minutes)}</strong></div>
                      ))}
                    </td>
                  </tr>
                );
              })}
              {configuration.externalDutyAssignments.length > 0 && (
                <tr className="night-row">
                  <th><strong>NOC</strong><span>Dyżury zablokowane</span></th>
                  {weekDates.map((date) => (
                    <td key={date}>
                      {configuration.externalDutyAssignments
                        .filter((item) => item.dutyType === "NIGHT" && item.startDateTime.slice(0, 10) === date)
                        .map((item) => <div className="internat-shift internat-shift--night" key={item.id}>{educatorById.get(item.educatorId)?.shortCode ?? item.educatorId}<small>{item.startDateTime.slice(11, 16)}–{item.endDateTime.slice(11, 16)}</small></div>)}
                    </td>
                  ))}
                  <td><StatusBadge value={`${configuration.externalDutyAssignments.length} DYŻURÓW`} /></td>
                </tr>
              )}
              <tr className="common-duty-row">
                <th>Stołówka</th>
                {weekDates.map((date) => {
                  const duty = configuration.commonAreaDuties.find((item) => item.date === date && item.dutyType === "DINING_ROOM");
                  const group = groups.find((item) => item.id === duty?.groupId);
                  return <td key={date}>{group ? `${group.code} · ${group.name}` : "—"}</td>;
                })}
                <td>Przydział grupowy</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}
      <section className="section-block">
        <div className="section-heading"><div><span className="eyebrow">KONTROLA GLOBALNA</span><h2>Konflikty międzygrupowe</h2></div></div>
        <MessagesTable
          messages={(generation?.validationReport?.messages ?? []).filter(
            (item) =>
              item.ruleId === "REQ-CROSS-GROUP-NO-OVERLAP-001" ||
              item.ruleId === "REQ-CROSS-GROUP-REST-001",
          )}
        />
      </section>
    </>
  );
}
