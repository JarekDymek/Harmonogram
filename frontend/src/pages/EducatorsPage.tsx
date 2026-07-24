import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { EmptyState, PageHeader, formatMinutes } from "../components/UI";
import { useAppState } from "../state/AppState";
import type { AssignmentOverride, Unavailability } from "../types";
import {
  formatPolishHours,
  hoursToMinutes,
  minutesToHours,
  parsePolishHours,
} from "../time";

const hoursField = z.string().refine(
  (value) => {
    try {
      parsePolishHours(value);
      return true;
    } catch {
      return false;
    }
  },
  "Podaj godziny w krokach co 0,5, np. 27,5.",
);

const educatorSchema = z.object({
  educators: z
    .array(
      z.object({
        displayName: z.string().min(2, "Podaj nazwę."),
        shortCode: z.string().min(1).max(5),
        baseWeeklyAssignedHours: hoursField,
        description: z.string(),
      }),
    )
    .min(3)
    .max(4),
});
type EducatorValues = z.infer<typeof educatorSchema>;

export function EducatorsPage() {
  const { configuration, setConfiguration } = useAppState();
  const [boundaryRows, setBoundaryRows] = useState<
    Array<{
      educatorId: string;
      previousDate: string;
      previousStart: string;
      previousEnd: string;
      nextDate: string;
      nextStart: string;
      nextEnd: string;
    }>
  >([]);
  const {
    register,
    reset,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<EducatorValues>({
    resolver: zodResolver(educatorSchema),
  });
  const overrideForm = useForm<{
    educatorId: string;
    weekNumber: number;
    assignedHours: string;
    reason: string;
  }>();
  const unavailableForm = useForm<{
    educatorId: string;
    type: "HARD" | "PREFERRED";
    scope: "RECURRING_WEEKLY" | "CYCLE_WEEK" | "SPECIFIC_DATE";
    dayOfWeek: number;
    weekNumber: number;
    date: string;
    startTime: string;
    endTime: string;
    description: string;
  }>();

  useEffect(() => {
    if (configuration) {
      reset({
        educators: configuration.educators.map((item) => ({
          displayName: item.displayName,
          shortCode: item.shortCode,
          baseWeeklyAssignedHours: formatPolishHours(
            minutesToHours(item.baseWeeklyAssignedMinutes),
          ),
          description: item.description,
        })),
      });
      overrideForm.reset({
        educatorId: configuration.educators[0]?.id,
        weekNumber: 1,
        assignedHours: "0",
        reason: "",
      });
      unavailableForm.reset({
        educatorId: configuration.educators[0]?.id,
        type: "HARD",
        scope: "RECURRING_WEEKLY",
        dayOfWeek: 0,
        weekNumber: 1,
        date: configuration.cycleStartDate,
        startTime: "08:00",
        endTime: "10:00",
        description: "",
      });
      const contexts = new Map(
        (configuration.boundaryContext?.educators ?? []).map((item) => [
          item.educatorId,
          item,
        ]),
      );
      setBoundaryRows(
        configuration.educators.map((educator) => {
          const context = contexts.get(educator.id);
          const previous = context?.lastAssignmentBefore;
          const next = context?.firstAssignmentAfter;
          return {
            educatorId: educator.id,
            previousDate: previous?.date ?? "",
            previousStart:
              previous ? `${String(Math.floor(previous.startMinute / 60)).padStart(2, "0")}:${String(previous.startMinute % 60).padStart(2, "0")}` : "",
            previousEnd:
              previous ? `${String(Math.floor(previous.endMinute / 60)).padStart(2, "0")}:${String(previous.endMinute % 60).padStart(2, "0")}` : "",
            nextDate: next?.date ?? "",
            nextStart:
              next ? `${String(Math.floor(next.startMinute / 60)).padStart(2, "0")}:${String(next.startMinute % 60).padStart(2, "0")}` : "",
            nextEnd:
              next ? `${String(Math.floor(next.endMinute / 60)).padStart(2, "0")}:${String(next.endMinute % 60).padStart(2, "0")}` : "",
          };
        }),
      );
    }
  }, [configuration, reset, overrideForm, unavailableForm]);

  if (!configuration) return <EmptyState>Najpierw utwórz konfigurację.</EmptyState>;

  const saveEducators = (values: EducatorValues) => {
    setConfiguration({
      ...configuration,
      educators: configuration.educators.map((item, index) => ({
        ...item,
        displayName: values.educators[index].displayName,
        shortCode: values.educators[index].shortCode,
        description: values.educators[index].description,
        baseWeeklyAssignedMinutes: hoursToMinutes(
          parsePolishHours(values.educators[index].baseWeeklyAssignedHours),
        ),
      })),
    });
  };

  const addOverride = overrideForm.handleSubmit((values) => {
    let assignedMinutes: number;
    try {
      assignedMinutes = hoursToMinutes(
        parsePolishHours(values.assignedHours),
      );
    } catch (caught) {
      overrideForm.setError("assignedHours", {
        message:
          caught instanceof Error
            ? caught.message
            : "Niepoprawna liczba godzin.",
      });
      return;
    }
    const item: AssignmentOverride = {
      id: crypto.randomUUID(),
      configurationVersionId: configuration.configurationVersionId,
      educatorId: values.educatorId,
      weekNumber: Number(values.weekNumber),
      assignedMinutes,
      reason: values.reason,
      approvedAt: new Date().toISOString(),
      approvedBy: "UŻYTKOWNIK",
    };
    const filtered = configuration.assignmentOverrides.filter(
      (existing) =>
        !(
          existing.educatorId === item.educatorId &&
          existing.weekNumber === item.weekNumber
        ),
    );
    setConfiguration({
      ...configuration,
      assignmentOverrides: [...filtered, item],
    });
  });

  const addUnavailability = unavailableForm.handleSubmit((values) => {
    const scope = values.scope;
    const item: Unavailability = {
      id: crypto.randomUUID(),
      educatorId: values.educatorId,
      type: values.type,
      scope,
      dayOfWeek: scope === "SPECIFIC_DATE" ? null : Number(values.dayOfWeek),
      weekNumber: scope === "CYCLE_WEEK" ? Number(values.weekNumber) : null,
      date: scope === "SPECIFIC_DATE" ? values.date : null,
      startTime: values.startTime,
      endTime: values.endTime,
      description: values.description,
    };
    setConfiguration({
      ...configuration,
      unavailability: [...configuration.unavailability, item],
    });
  });

  const setBoundaryField = (
    educatorId: string,
    field: keyof (typeof boundaryRows)[number],
    value: string,
  ) => {
    setBoundaryRows((current) =>
      current.map((row) =>
        row.educatorId === educatorId ? { ...row, [field]: value } : row,
      ),
    );
  };

  const timeToMinute = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const saveBoundaryContext = () => {
    const incomplete = boundaryRows.some(
      (row) =>
        (row.previousDate &&
          (!row.previousStart || !row.previousEnd)) ||
        (row.nextDate && (!row.nextStart || !row.nextEnd)),
    );
    if (incomplete) {
      window.alert(
        "Dla każdej podanej daty granicznej uzupełnij godzinę początku i końca.",
      );
      return;
    }
    const educators = boundaryRows
      .filter((row) => row.previousDate || row.nextDate)
      .map((row) => ({
        educatorId: row.educatorId,
        lastAssignmentBefore: row.previousDate
          ? {
              date: row.previousDate,
              startMinute: timeToMinute(row.previousStart),
              endMinute: timeToMinute(row.previousEnd),
            }
          : null,
        firstAssignmentAfter: row.nextDate
          ? {
              date: row.nextDate,
              startMinute: timeToMinute(row.nextStart),
              endMinute: timeToMinute(row.nextEnd),
            }
          : null,
      }));
    setConfiguration({
      ...configuration,
      boundaryContext: educators.length ? { educators } : null,
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="KROK 03 · ZESPÓŁ"
        title={`${configuration.educatorCount} wychowawców`}
        description="Podstawowe przydziały są źródłem prawdy. Wyjątek tygodniowy zawsze wymaga jawnego rekordu."
      />
      <form className="stack" onSubmit={handleSubmit(saveEducators)}>
        <div className="educator-grid">
          {configuration.educators.map((educator, index) => (
            <article className="person-card" key={educator.id}>
              <div className={`avatar avatar--${index + 1}`}>{educator.id}</div>
              <div className="person-card__title">
                <span>Wychowawca {educator.id}</span>
                <strong>{educator.shortCode}</strong>
              </div>
              <label>
                Imię i nazwisko
                <input {...register(`educators.${index}.displayName`)} />
                {errors.educators?.[index]?.displayName && (
                  <em>{errors.educators[index]?.displayName?.message}</em>
                )}
              </label>
              <label>
                Skrót
                <input {...register(`educators.${index}.shortCode`)} />
              </label>
              <label>
                Godziny tygodniowo
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.5"
                  {...register(`educators.${index}.baseWeeklyAssignedHours`)}
                  onBlur={(event) => {
                    try {
                      setValue(
                        `educators.${index}.baseWeeklyAssignedHours`,
                        formatPolishHours(
                          parsePolishHours(event.currentTarget.value),
                        ),
                        { shouldValidate: true },
                      );
                    } catch {
                      // Komunikat walidacji pojawi się pod polem.
                    }
                  }}
                />
                <small>Wpisz np. 27,5. Krok: 0,5 godziny.</small>
                {errors.educators?.[index]?.baseWeeklyAssignedHours && (
                  <em>
                    {
                      errors.educators[index]?.baseWeeklyAssignedHours
                        ?.message
                    }
                  </em>
                )}
              </label>
              <label>
                Opis
                <textarea rows={3} {...register(`educators.${index}.description`)} />
              </label>
            </article>
          ))}
        </div>
        <div className="align-right">
          <button className="button button--primary" type="submit">
            Zapisz dane wychowawców
          </button>
        </div>
      </form>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">PRZYDZIAŁY ZASTĘPCZE</span>
            <h2>Wyjątek dla wychowawcy i tygodnia</h2>
          </div>
        </div>
        <form className="inline-form" onSubmit={addOverride}>
          <label>
            Wychowawca
            <select {...overrideForm.register("educatorId")}>
              {configuration.educators.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.shortCode}
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
              {...overrideForm.register("weekNumber", { valueAsNumber: true })}
            />
          </label>
          <label>
            Godziny
            <input
              type="text"
              inputMode="decimal"
              step="0.5"
              required
              {...overrideForm.register("assignedHours")}
              onBlur={(event) => {
                try {
                  overrideForm.setValue(
                    "assignedHours",
                    formatPolishHours(
                      parsePolishHours(event.currentTarget.value),
                    ),
                  );
                } catch {
                  // Pole zostanie odrzucone podczas zapisu.
                }
              }}
            />
            <small>Przykład: 27,5 godz.</small>
            {overrideForm.formState.errors.assignedHours && (
              <em>
                {overrideForm.formState.errors.assignedHours.message}
              </em>
            )}
          </label>
          <label className="inline-form__wide">
            Powód i zatwierdzenie
            <input required {...overrideForm.register("reason")} />
          </label>
          <button className="button button--secondary" type="submit">
            Dodaj lub zastąp
          </button>
        </form>
        <div className="chip-list">
          {configuration.assignmentOverrides.map((item) => (
            <span className="record-chip" key={item.id}>
              {item.educatorId} · tydz. {item.weekNumber} ·{" "}
              {formatMinutes(item.assignedMinutes)}
              <button
                type="button"
                aria-label={`Usuń przydział ${item.id}`}
                onClick={() =>
                  setConfiguration({
                    ...configuration,
                    assignmentOverrides:
                      configuration.assignmentOverrides.filter(
                        (value) => value.id !== item.id,
                      ),
                  })
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">DOSTĘPNOŚĆ</span>
            <h2>Zakazy i preferencje</h2>
          </div>
        </div>
        <form className="inline-form" onSubmit={addUnavailability}>
          <label>
            Osoba
            <select {...unavailableForm.register("educatorId")}>
              {configuration.educators.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.shortCode}
                </option>
              ))}
            </select>
          </label>
          <label>
            Typ
            <select {...unavailableForm.register("type")}>
              <option value="HARD">HARD — zakaz</option>
              <option value="PREFERRED">PREFERRED — preferencja</option>
            </select>
          </label>
          <label>
            Zakres
            <select {...unavailableForm.register("scope")}>
              <option value="RECURRING_WEEKLY">Dzień co tydzień</option>
              <option value="CYCLE_WEEK">Dzień w tygodniu cyklu</option>
              <option value="SPECIFIC_DATE">Konkretna data</option>
            </select>
          </label>
          <label>
            Dzień (0–6)
            <input
              type="number"
              min="0"
              max="6"
              {...unavailableForm.register("dayOfWeek", {
                valueAsNumber: true,
              })}
            />
          </label>
          <label>
            Tydzień
            <input
              type="number"
              min="1"
              max={configuration.planningHorizonWeeks}
              {...unavailableForm.register("weekNumber", {
                valueAsNumber: true,
              })}
            />
          </label>
          <label>
            Data
            <input type="date" {...unavailableForm.register("date")} />
          </label>
          <label>
            Od
            <input type="time" step="1800" {...unavailableForm.register("startTime")} />
          </label>
          <label>
            Do
            <input type="time" step="1800" {...unavailableForm.register("endTime")} />
          </label>
          <label className="inline-form__wide">
            Opis
            <input {...unavailableForm.register("description")} />
          </label>
          <button className="button button--secondary" type="submit">
            Dodaj niedostępność
          </button>
        </form>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Osoba</th>
                <th>Typ</th>
                <th>Zakres</th>
                <th>Dzień / data</th>
                <th>Godziny</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {configuration.unavailability.map((item) => (
                <tr key={item.id}>
                  <td>{item.educatorId}</td>
                  <td>{item.type}</td>
                  <td>{item.scope}</td>
                  <td>{item.date ?? `dzień ${item.dayOfWeek}`}</td>
                  <td>
                    {item.startTime}–{item.endTime}
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Usuń niedostępność ${item.id}`}
                      onClick={() =>
                        setConfiguration({
                          ...configuration,
                          unavailability: configuration.unavailability.filter(
                            (value) => value.id !== item.id,
                          ),
                        })
                      }
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">KONTEKST GRANICZNY</span>
            <h2>Praca przed i po horyzoncie</h2>
          </div>
          <button
            className="button button--secondary"
            type="button"
            onClick={saveBoundaryContext}
          >
            Zapisz kontekst
          </button>
        </div>
        <p className="muted">
          Opcjonalne dane zwiększają zakres kontroli odpoczynku w trybie
          skończonym. Pozostaw cały wiersz pusty, jeśli przydział nie jest
          znany.
        </p>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Osoba</th>
                <th>Poprzednia data</th>
                <th>Od</th>
                <th>Do</th>
                <th>Następna data</th>
                <th>Od</th>
                <th>Do</th>
              </tr>
            </thead>
            <tbody>
              {boundaryRows.map((row) => (
                <tr key={row.educatorId}>
                  <td>{row.educatorId}</td>
                  <td>
                    <input
                      type="date"
                      value={row.previousDate}
                      onChange={(event) =>
                        setBoundaryField(
                          row.educatorId,
                          "previousDate",
                          event.target.value,
                        )
                      }
                    />
                  </td>
                  {(["previousStart", "previousEnd"] as const).map(
                    (field) => (
                      <td key={field}>
                        <input
                          type="time"
                          step="1800"
                          required={Boolean(row.previousDate)}
                          value={row[field]}
                          onChange={(event) =>
                            setBoundaryField(
                              row.educatorId,
                              field,
                              event.target.value,
                            )
                          }
                        />
                      </td>
                    ),
                  )}
                  <td>
                    <input
                      type="date"
                      value={row.nextDate}
                      onChange={(event) =>
                        setBoundaryField(
                          row.educatorId,
                          "nextDate",
                          event.target.value,
                        )
                      }
                    />
                  </td>
                  {(["nextStart", "nextEnd"] as const).map((field) => (
                    <td key={field}>
                      <input
                        type="time"
                        step="1800"
                        required={Boolean(row.nextDate)}
                        value={row[field]}
                        onChange={(event) =>
                          setBoundaryField(
                            row.educatorId,
                            field,
                            event.target.value,
                          )
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
