import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { EmptyState, PageHeader, formatMinutes } from "../components/UI";
import { useAppState } from "../state/AppState";
import type { AssignmentOverride, Unavailability } from "../types";

const educatorSchema = z.object({
  educators: z
    .array(
      z.object({
        displayName: z.string().min(2, "Podaj nazwę."),
        shortCode: z.string().min(1).max(5),
        baseWeeklyAssignedMinutes: z
          .number()
          .int()
          .nonnegative()
          .multipleOf(30, "Wymagana wielokrotność 30 minut."),
        description: z.string(),
      }),
    )
    .length(3),
});
type EducatorValues = z.infer<typeof educatorSchema>;

export function EducatorsPage() {
  const { configuration, setConfiguration } = useAppState();
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<EducatorValues>({
    resolver: zodResolver(educatorSchema),
  });
  const overrideForm = useForm<{
    educatorId: string;
    weekNumber: number;
    assignedMinutes: number;
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
          baseWeeklyAssignedMinutes: item.baseWeeklyAssignedMinutes,
          description: item.description,
        })),
      });
      overrideForm.reset({
        educatorId: configuration.educators[0]?.id,
        weekNumber: 1,
        assignedMinutes: 0,
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
    }
  }, [configuration, reset, overrideForm, unavailableForm]);

  if (!configuration) return <EmptyState>Najpierw utwórz konfigurację.</EmptyState>;

  const saveEducators = (values: EducatorValues) => {
    setConfiguration({
      ...configuration,
      educators: configuration.educators.map((item, index) => ({
        ...item,
        ...values.educators[index],
      })),
    });
  };

  const addOverride = overrideForm.handleSubmit((values) => {
    const item: AssignmentOverride = {
      id: crypto.randomUUID(),
      configurationVersionId: configuration.configurationVersionId,
      educatorId: values.educatorId,
      weekNumber: Number(values.weekNumber),
      assignedMinutes: Number(values.assignedMinutes),
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

  return (
    <>
      <PageHeader
        eyebrow="KROK 03 · ZESPÓŁ"
        title="Dokładnie trzech wychowawców"
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
                Minuty tygodniowo
                <input
                  type="number"
                  step="30"
                  {...register(
                    `educators.${index}.baseWeeklyAssignedMinutes`,
                    { valueAsNumber: true },
                  )}
                />
                <small>
                  {formatMinutes(
                    configuration.educators[index].baseWeeklyAssignedMinutes,
                  )}
                </small>
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
              max="6"
              {...overrideForm.register("weekNumber", { valueAsNumber: true })}
            />
          </label>
          <label>
            Minuty
            <input
              type="number"
              step="30"
              {...overrideForm.register("assignedMinutes", {
                valueAsNumber: true,
              })}
            />
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
              max="6"
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
    </>
  );
}
