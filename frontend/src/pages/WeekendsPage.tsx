import { SectionTiles } from "../components/SectionTiles";
import { deriveWeekendMetadata } from "../weekendMetadata";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { EmptyState, PageHeader, StatusBadge } from "../components/UI";
import { useAppState } from "../state/AppState";
import type { WeekendVariant, WeekendDaysOffPattern } from "../types";
import { WeekendDaysOffEditor, validDaysOff } from "../components/WeekendDaysOffEditor";
import { prepareConfigurationForApi } from "../nightDuties";
import { minutesToTime } from "../components/UI";

export function WeekendsPage() {
  const { configuration, setConfiguration, inputReport } = useAppState();
  const [variants, setVariants] = useState<WeekendVariant[]>([]);
  const [daysOffPatterns, setDaysOffPatterns] = useState<WeekendDaysOffPattern[]>([]);
  const [saveMessage, setSaveMessage] = useState("");
  const substituteForm = useForm<{
    basePosition: number;
    weekNumber: number;
    saturdayDate: string;
    sundayDate: string;
  }>();

  useEffect(() => {
    if (configuration) {
      setDaysOffPatterns(structuredClone(configuration.weekendDaysOffPatterns ?? []));
      setVariants(
        structuredClone(
          configuration.weekendVariants.filter(
            (item) => item.groupId === configuration.activeGroupId,
          ),
        ),
      );
      const saturday = new Date(`${configuration.cycleStartDate}T12:00:00Z`);
      saturday.setUTCDate(saturday.getUTCDate() + 5);
      const sunday = new Date(saturday);
      sunday.setUTCDate(sunday.getUTCDate() + 1);
      substituteForm.reset({
        basePosition: 1,
        weekNumber: 1,
        saturdayDate: saturday.toISOString().slice(0, 10),
        sundayDate: sunday.toISOString().slice(0, 10),
      });
    }
  }, [configuration, substituteForm]);

  if (!configuration) return <EmptyState>Najpierw utwórz konfigurację.</EmptyState>;

  const memberIds = new Set(
    configuration.groupMemberships
      .filter(
        (item) => item.active && item.groupId === configuration.activeGroupId,
      )
      .map((item) => item.educatorId),
  );
  const groupEducators = configuration.educators.filter((item) =>
    memberIds.has(item.id),
  );

  const base = variants
    .filter((item) => item.variantKind === "BASE")
    .sort((a, b) => (a.positionInCycle ?? 0) - (b.positionInCycle ?? 0));
  const substitutes = variants.filter((item) => item.variantKind === "SUBSTITUTE");
  const requiredWeekends = (prepareConfigurationForApi(configuration).requiredAssignments ?? []).filter(a =>
    a.groupId === configuration.activeGroupId && [0, 6].includes(new Date(`${a.date}T12:00:00Z`).getUTCDay()));
  const educatorName = (id: string) => groupEducators.find(e => e.id === id)?.displayName ?? id;

  const addMissingBase = () => {
    const missing = [1,2,3,4,5,6].filter(p => !base.some(v => v.positionInCycle === p));
    const additions: WeekendVariant[] = missing.map(position => ({
      id: crypto.randomUUID(), configurationVersionId: configuration.configurationVersionId,
      groupId: configuration.activeGroupId, variantKind: "BASE", positionInCycle: position,
      offEducatorId: null, approved: false, approvalReference: "Do uzupełnienia i zapisania",
      approvedAt: new Date().toISOString(), approvedBy: "",
      saturdayTemplate: {id: crypto.randomUUID(), dayOfWeek: "SATURDAY", assignments: [
        {id: crypto.randomUUID(), educatorId: "", startTime: "06:00", endTime: "14:00", sequenceNumber: 1},
        {id: crypto.randomUUID(), educatorId: "", startTime: "14:00", endTime: "22:00", sequenceNumber: 2},
      ]},
      sundayTemplate: {id: crypto.randomUUID(), dayOfWeek: "SUNDAY", assignments: [
        {id: crypto.randomUUID(), educatorId: "", startTime: "06:00", endTime: "14:00", sequenceNumber: 1},
        {id: crypto.randomUUID(), educatorId: "", startTime: "14:00", endTime: "22:00", sequenceNumber: 2},
      ]},
    }));
    setVariants([...variants, ...additions]);
    setSaveMessage("Utworzono formularze tylko dla tej grupy. Wybierz osoby, sprawdź godziny i zapisz wzorce.");
  };

  const changeRows = (id: string, day: "saturdayTemplate" | "sundayTemplate", remove?: number) => {
    setVariants(current => current.map(v => v.id !== id ? v : {
      ...v, [day]: {...v[day], assignments: (remove === undefined
        ? [...v[day].assignments, {id: crypto.randomUUID(), educatorId: "", startTime: "20:00", endTime: "22:00", sequenceNumber: 0}]
        : v[day].assignments.filter((_,i) => i !== remove)).map((a,i) => ({...a, sequenceNumber: i+1}))},
    }));
  };

  const updateAssignment = (
    variantId: string,
    day: "saturdayTemplate" | "sundayTemplate",
    index: number,
    field: "educatorId" | "startTime" | "endTime",
    value: string,
  ) => {
    setVariants((current) =>
      current.map((variant) => {
        if (variant.id !== variantId) return variant;
        const assignments = [...variant[day].assignments];
        assignments[index] = { ...assignments[index], [field]: value };
        return {
          ...variant,
          [day]: { ...variant[day], assignments },
        };
      }),
    );
  };

  const save = (nextVariants = variants) => {
    if (daysOffPatterns.some(pattern => memberIds.has(pattern.educatorId) && !validDaysOff(pattern))) {
      setSaveMessage("Nie zapisano zmian: wybierz dwa różne dni w czerwonym wzorcu wolnego.");
      return;
    }
    if (nextVariants.some(v => [v.saturdayTemplate,v.sundayTemplate].some(t =>
      !t.assignments.length || t.assignments.some(a => !memberIds.has(a.educatorId) || !a.startTime || !a.endTime || a.startTime >= a.endTime)))) {
      setSaveMessage("Nie zapisano: w każdym odcinku weekendu wybierz wychowawcę tej grupy i poprawne godziny od–do.");
      return;
    }
    const approvedVariants = nextVariants.map(v => {
      return {...v, approved: true, approvedAt: new Date().toISOString(), approvedBy: "UŻYTKOWNIK",
        approvalReference: "Zapisano przez użytkownika",
        offEducatorId: deriveWeekendMetadata(configuration, v).offEducatorId};
    });
    setConfiguration({
      ...configuration,
      weekendDaysOffPatterns: daysOffPatterns,
      weekendVariants: [
        ...configuration.weekendVariants.filter(
          (item) => item.groupId !== configuration.activeGroupId,
        ),
        ...approvedVariants,
      ],
    });
    setSaveMessage("Zapisano wzorce weekendów i dni wolnych. Teraz sprawdź dane i wygeneruj plan ponownie.");
  };

  const addSubstitute = substituteForm.handleSubmit((values) => {
    const source = base.find(
      (item) => item.positionInCycle === Number(values.basePosition),
    );
    if (!source) { setSaveMessage("Najpierw utwórz wzorce bazowe tej grupy."); return; }
    const item = structuredClone(source);
    item.id = crypto.randomUUID();
    item.variantKind = "SUBSTITUTE";
    item.positionInCycle = null;
    item.replacesWeekendRotationVariantId = source.id;
    item.applicableWeekNumber = Number(values.weekNumber);
    item.applicableSaturdayDate = values.saturdayDate;
    item.applicableSundayDate = values.sundayDate;
    item.offEducatorId = deriveWeekendMetadata(configuration, item).offEducatorId;
    item.approvalReference = "ZATWIERDZENIE-UŻYTKOWNIKA";
    item.approvedAt = new Date().toISOString();
    item.approvedBy = "UŻYTKOWNIK";
    item.saturdayTemplate.id = crypto.randomUUID();
    item.sundayTemplate.id = crypto.randomUUID();
    for (const template of [
      item.saturdayTemplate,
      item.sundayTemplate,
    ]) {
      template.assignments.forEach((assignment) => {
        assignment.id = crypto.randomUUID();
      });
    }
    const next = [
      ...variants.filter(
        (existing) =>
          !(
            existing.variantKind === "SUBSTITUTE" &&
            existing.replacesWeekendRotationVariantId ===
              item.replacesWeekendRotationVariantId &&
            existing.applicableWeekNumber === item.applicableWeekNumber &&
            existing.applicableSaturdayDate === item.applicableSaturdayDate &&
            existing.applicableSundayDate === item.applicableSundayDate
          ),
      ),
      item,
    ];
    setVariants(next);
    save(next);
  });

  return (
    <SectionTiles>
      <PageHeader
        eyebrow="KROK 05 · WEEKENDY"
        title="Weekendy i stałe dni wolne"
        description="Wzorzec ustala opiekę dzienną w sobotę i niedzielę. Brak dyżuru w tym wzorcu nie oznacza dnia wolnego: nocki, szkoła i praca w innych grupach są liczone osobno w całkowitych dniach pracy."
        actions={
          <button className="button button--primary" type="button" onClick={() => save()}>
            Zapisz wzorce
          </button>
        }
      />
      {saveMessage && <p role="status">{saveMessage}</p>}
      {requiredWeekends.length > 0 && (
        <section className="section-block" id="staly-plan-weekend">
          <h2>Obowiązkowe dyżury mają pierwszeństwo</h2>
          <p>Poniższe godziny są już obsadzone. Generator wyłączy je z przydziałów rotacji i ułoży resztę opieki wokół nich. Nie musisz skracać wzorców ręcznie. Wymiary tygodniowe pozostają bez zmian.</p>
          <ul>{requiredWeekends.map((duty, i) => (
            <li key={i}>{duty.date}, {minutesToTime(duty.startMinute)}–{minutesToTime(duty.endMinute)}: {educatorName(duty.educatorId)}</li>
          ))}</ul>
        </section>
      )}
      <WeekendDaysOffEditor educators={groupEducators} patterns={daysOffPatterns}
        messages={inputReport?.messages ?? []} onChange={patterns => {
          setDaysOffPatterns(patterns); setSaveMessage("Niezapisane zmiany — kliknij Zapisz wzorce.");
        }} />
      <div className="weekend-grid" id="wzorce-weekendowe">
        {base.length < 6 && <section className="section-block">
          <h2>Wzorce weekendów grupy {configuration.groups.find(g => g.id === configuration.activeGroupId)?.code}</h2>
          <p>Brakujące pozycje mają osobne formularze dla soboty i niedzieli. Nie kopiujemy obsady z innych grup.</p>
          <button type="button" className="button button--secondary" onClick={addMissingBase}>Utwórz brakujące wzorce weekendów</button>
        </section>}
        {base.map((variant) => {
          const working = new Set([
            ...variant.saturdayTemplate.assignments.map(
              (item) => item.educatorId,
            ),
            ...variant.sundayTemplate.assignments.map(
              (item) => item.educatorId,
            ),
          ]);
          const notWorking = groupEducators
            .filter((item) => !working.has(item.id))
            .map((item) => item.shortCode)
            .join(", ");
          return (
          <article
            className="weekend-card"
            id={`weekend-pozycja-${variant.positionInCycle}`}
            key={variant.id}
          >
            <header>
              <div>
                <span className="card-number">
                  {String(variant.positionInCycle).padStart(2, "0")}
                </span>
                <h2>Pozycja {variant.positionInCycle}</h2>
              </div>
              <div className="off-person">
                <small>Bez opieki dziennej w tym wzorcu</small>
                <strong>{notWorking || "—"}</strong>
              </div>
            </header>
            {(
              [
                ["saturdayTemplate", "Sobota"],
                ["sundayTemplate", "Niedziela"],
              ] as const
            ).map(([day, label]) => (
              <div className="weekend-day" key={day}>
                <strong>{label}</strong>
                {variant[day].assignments.map((assignment, index) => (
                  <div className="assignment-editor" key={assignment.id}>
                    <span>{assignment.sequenceNumber}</span>
                    <select
                      aria-label={`${label}, odcinek ${index + 1}, wychowawca`}
                      value={assignment.educatorId}
                      onChange={(event) =>
                        updateAssignment(
                          variant.id,
                          day,
                          index,
                          "educatorId",
                          event.target.value,
                        )
                      }
                    >
                      <option value="">Wybierz wychowawcę</option>
                      {groupEducators.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.displayName}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label={`${label}, odcinek ${index + 1}, początek`}
                      type="time"
                      step="1800"
                      value={assignment.startTime}
                      onChange={(event) =>
                        updateAssignment(
                          variant.id,
                          day,
                          index,
                          "startTime",
                          event.target.value,
                        )
                      }
                    />
                    <span>—</span>
                    <input
                      aria-label={`${label}, odcinek ${index + 1}, koniec`}
                      type="time"
                      step="1800"
                      value={assignment.endTime}
                      onChange={(event) =>
                        updateAssignment(
                          variant.id,
                          day,
                          index,
                          "endTime",
                          event.target.value,
                        )
                      }
                    />
                    <button type="button" className="icon-button" aria-label={`Usuń ${label}, odcinek ${index + 1}, pozycja ${variant.positionInCycle}`}
                      onClick={() => changeRows(variant.id, day, index)}>×</button>
                  </div>
                ))}
                <button type="button" className="button button--secondary" onClick={() => changeRows(variant.id, day)}>Dodaj odcinek — {label}</button>
              </div>
            ))}
            <footer>
              <StatusBadge value={variant.approved ? "APPROVED" : "DRAFT"} />
              <small>{variant.approvalReference}</small>
            </footer>
          </article>
          );
        })}
      </div>
      <section className="section-block" id="dzien-specjalny-weekend">
        <div className="section-heading">
          <div>
            <span className="eyebrow">DZIEŃ SPECJALNY W WEEKEND</span>
            <h2>Warianty zastępcze</h2>
          </div>
          <StatusBadge value={`${substitutes.length} SUBSTITUTE`} />
        </div>
        <form className="inline-form" onSubmit={addSubstitute}>
          <label>
            Pozycja bazowa
            <select
              {...substituteForm.register("basePosition", {
                valueAsNumber: true,
              })}
            >
              {[1, 2, 3, 4, 5, 6].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tydzień
            <input
              type="number"
              min="1"
              max={configuration.planningHorizonWeeks}
              {...substituteForm.register("weekNumber", {
                valueAsNumber: true,
              })}
            />
          </label>
          <label>
            Sobota
            <input
              type="date"
              required
              {...substituteForm.register("saturdayDate")}
            />
          </label>
          <label>
            Niedziela
            <input
              type="date"
              required
              {...substituteForm.register("sundayDate")}
            />
          </label>
<p>Osoby bez opieki dziennej zostaną ustalone z obsady. Nie wpisujesz ich ponownie w osobnym polu.</p>
          <button className="button button--secondary" type="submit">
            Dodaj przez pełne sklonowanie
          </button>
        </form>
        {substitutes.length ? (
          <div className="record-list">
            {substitutes.map((item) => (
              <article
                className="substitute-card"
                id={`weekend-zastepczy-${item.id}`}
                key={item.id}
              >
                <div className="record-row">
                  <div>
                    <strong>
                      Tydzień {item.applicableWeekNumber} ·{" "}
                      {item.applicableSaturdayDate}
                    </strong>
                    <small>
                      Zastępuje {item.replacesWeekendRotationVariantId}
                    </small>
                  </div>
                  <StatusBadge value={item.approved ? "APPROVED" : "DRAFT"} />
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Usuń wariant zastępczy ${item.id}`}
                    onClick={() => {
                      const next = variants.filter(
                        (value) => value.id !== item.id,
                      );
                      setVariants(next);
                      save(next);
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="substitute-editor">
                  {(
                    [
                      ["saturdayTemplate", "Sobota"],
                      ["sundayTemplate", "Niedziela"],
                    ] as const
                  ).map(([day, label]) => (
                    <div className="weekend-day" key={day}>
                      <strong>{label}</strong>
                      {item[day].assignments.map((assignment, index) => (
                        <div
                          className="assignment-editor"
                          key={assignment.id}
                        >
                          <span>{assignment.sequenceNumber}</span>
                          <select
                            aria-label={`${label} SUBSTITUTE, odcinek ${index + 1}, wychowawca`}
                            value={assignment.educatorId}
                            onChange={(event) =>
                              updateAssignment(
                                item.id,
                                day,
                                index,
                                "educatorId",
                                event.target.value,
                              )
                            }
                          >
                            {groupEducators.map((educator) => (
                              <option key={educator.id} value={educator.id}>
                                {educator.shortCode}
                              </option>
                            ))}
                          </select>
                          <input
                            aria-label={`${label} SUBSTITUTE, odcinek ${index + 1}, początek`}
                            type="time"
                            step="1800"
                            value={assignment.startTime}
                            onChange={(event) =>
                              updateAssignment(
                                item.id,
                                day,
                                index,
                                "startTime",
                                event.target.value,
                              )
                            }
                          />
                          <span>—</span>
                          <input
                            aria-label={`${label} SUBSTITUTE, odcinek ${index + 1}, koniec`}
                            type="time"
                            step="1800"
                            value={assignment.endTime}
                            onChange={(event) =>
                              updateAssignment(
                                item.id,
                                day,
                                index,
                                "endTime",
                                event.target.value,
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">
            Brak wariantów zastępczych. Jeśli dzień specjalny zmieni weekendowe
            zapotrzebowanie, walidacja zablokuje uruchomienie solvera.
          </p>
        )}
      </section>
    </SectionTiles>
  );
}
