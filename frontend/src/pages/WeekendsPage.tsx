import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { EmptyState, PageHeader, StatusBadge } from "../components/UI";
import { useAppState } from "../state/AppState";
import type { WeekendVariant } from "../types";

export function WeekendsPage() {
  const { configuration, setConfiguration } = useAppState();
  const [variants, setVariants] = useState<WeekendVariant[]>([]);
  const substituteForm = useForm<{
    basePosition: number;
    weekNumber: number;
    saturdayDate: string;
    sundayDate: string;
    offEducatorId: string;
  }>();

  useEffect(() => {
    if (configuration) {
      setVariants(structuredClone(configuration.weekendVariants));
      const saturday = new Date(`${configuration.cycleStartDate}T12:00:00Z`);
      saturday.setUTCDate(saturday.getUTCDate() + 5);
      const sunday = new Date(saturday);
      sunday.setUTCDate(sunday.getUTCDate() + 1);
      substituteForm.reset({
        basePosition: 1,
        weekNumber: 1,
        saturdayDate: saturday.toISOString().slice(0, 10),
        sundayDate: sunday.toISOString().slice(0, 10),
        offEducatorId:
          configuration.educatorCount === 3
            ? configuration.educators[2]?.id
            : "",
      });
    }
  }, [configuration, substituteForm]);

  if (!configuration) return <EmptyState>Najpierw utwórz konfigurację.</EmptyState>;

  const base = variants
    .filter((item) => item.variantKind === "BASE")
    .sort((a, b) => (a.positionInCycle ?? 0) - (b.positionInCycle ?? 0));
  const substitutes = variants.filter((item) => item.variantKind === "SUBSTITUTE");

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

  const save = () => {
    setConfiguration({ ...configuration, weekendVariants: variants });
  };

  const addSubstitute = substituteForm.handleSubmit((values) => {
    const source = base.find(
      (item) => item.positionInCycle === Number(values.basePosition),
    );
    if (!source) return;
    const item = structuredClone(source);
    item.id = crypto.randomUUID();
    item.variantKind = "SUBSTITUTE";
    item.positionInCycle = null;
    item.replacesWeekendRotationVariantId = source.id;
    item.applicableWeekNumber = Number(values.weekNumber);
    item.applicableSaturdayDate = values.saturdayDate;
    item.applicableSundayDate = values.sundayDate;
    item.offEducatorId = values.offEducatorId || null;
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
    setConfiguration({ ...configuration, weekendVariants: next });
  });

  return (
    <>
      <PageHeader
        eyebrow="KROK 05 · WEEKENDY"
        title="Zatwierdzone wzorce 1:1"
        description="Każdy odcinek jest wejściem krytycznym. Dla czterech osób wzorzec nadal jawnie wskazuje dokładnie dwie osoby pracujące, bez automatycznego założenia o sprawiedliwości."
        actions={
          <button className="button button--primary" type="button" onClick={save}>
            Zapisz wzorce
          </button>
        }
      />
      <div className="weekend-grid">
        {base.map((variant) => {
          const working = new Set([
            ...variant.saturdayTemplate.assignments.map(
              (item) => item.educatorId,
            ),
            ...variant.sundayTemplate.assignments.map(
              (item) => item.educatorId,
            ),
          ]);
          const notWorking = configuration.educators
            .filter((item) => !working.has(item.id))
            .map((item) => item.shortCode)
            .join(", ");
          return (
          <article className="weekend-card" key={variant.id}>
            <header>
              <div>
                <span className="card-number">
                  {String(variant.positionInCycle).padStart(2, "0")}
                </span>
                <h2>Pozycja {variant.positionInCycle}</h2>
              </div>
              <div className="off-person">
                <small>Nie pracują</small>
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
                      {configuration.educators.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.shortCode}
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
                  </div>
                ))}
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
      <section className="section-block">
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
          <label>
            Oznaczona osoba niepracująca
            <select {...substituteForm.register("offEducatorId")}>
              {configuration.educatorCount === 4 && (
                <option value="">Bez pojedynczego wskazania</option>
              )}
              {configuration.educators.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.shortCode}
                </option>
              ))}
            </select>
          </label>
          <button className="button button--secondary" type="submit">
            Dodaj przez pełne sklonowanie
          </button>
        </form>
        {substitutes.length ? (
          <div className="record-list">
            {substitutes.map((item) => (
              <article className="substitute-card" key={item.id}>
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
                      setConfiguration({
                        ...configuration,
                        weekendVariants: next,
                      });
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
                            {configuration.educators.map((educator) => (
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
    </>
  );
}
