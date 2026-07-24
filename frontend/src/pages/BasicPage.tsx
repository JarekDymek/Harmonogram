import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DemoNotice, EmptyState, PageHeader, StatusBadge } from "../components/UI";
import { useAppState } from "../state/AppState";

const schema = z.object({
  projectName: z.string().min(3, "Podaj nazwę projektu."),
  groupName: z.string().min(2, "Podaj nazwę grupy."),
  cycleStartDate: z.string().min(1, "Wybierz datę."),
  timeZoneId: z.string().min(3, "Podaj strefę IANA."),
  startingWeekendVariant: z.number().int().min(1).max(6),
  requestedOperationMode: z.enum(["PRODUCTION", "DEMONSTRATION"]),
  educatorCount: z.union([z.literal(3), z.literal(4)]),
  planningHorizonWeeks: z.number().int().min(1).max(6),
  scheduleBoundaryMode: z.enum(["FINITE", "CYCLIC"]),
}).superRefine((value, context) => {
  if (
    value.scheduleBoundaryMode === "CYCLIC" &&
    value.planningHorizonWeeks !== 6
  ) {
    context.addIssue({
      code: "custom",
      path: ["scheduleBoundaryMode"],
      message: "Tryb cykliczny wymaga dokładnie sześciu tygodni.",
    });
  }
});
type FormValues = z.infer<typeof schema>;

export function BasicPage() {
  const { configuration, setConfiguration } = useAppState();
  const {
    register,
    reset,
    watch,
    handleSubmit,
    formState: { errors, isSubmitSuccessful },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: configuration
      ? {
          projectName: configuration.projectName,
          groupName: configuration.groupName,
          cycleStartDate: configuration.cycleStartDate,
          timeZoneId: configuration.timeZoneId,
          startingWeekendVariant: configuration.startingWeekendVariant,
          requestedOperationMode: configuration.requestedOperationMode,
          educatorCount: configuration.educatorCount,
          planningHorizonWeeks: configuration.planningHorizonWeeks,
          scheduleBoundaryMode: configuration.scheduleBoundaryMode,
        }
      : undefined,
  });

  useEffect(() => {
    if (configuration) {
      reset({
        projectName: configuration.projectName,
        groupName: configuration.groupName,
        cycleStartDate: configuration.cycleStartDate,
        timeZoneId: configuration.timeZoneId,
        startingWeekendVariant: configuration.startingWeekendVariant,
        requestedOperationMode: configuration.requestedOperationMode,
        educatorCount: configuration.educatorCount,
        planningHorizonWeeks: configuration.planningHorizonWeeks,
        scheduleBoundaryMode: configuration.scheduleBoundaryMode,
      });
    }
  }, [configuration, reset]);

  if (!configuration) {
    return (
      <EmptyState>
        Wróć na stronę startową i utwórz konfigurację albo wczytaj demonstrację.
      </EmptyState>
    );
  }

  const selectedHorizon = watch(
    "planningHorizonWeeks",
    configuration.planningHorizonWeeks,
  );

  const submit = (values: FormValues) => {
    let educators = configuration.educators;
    let assignmentOverrides = configuration.assignmentOverrides;
    let unavailability = configuration.unavailability;
    let weekendVariants = configuration.weekendVariants;
    let boundaryContext = configuration.boundaryContext;

    if (values.educatorCount === 4 && configuration.educatorCount === 3) {
      educators = [
        ...configuration.educators,
        {
          id: "D",
          groupId: configuration.groupId,
          displayName: "",
          shortCode: "",
          baseWeeklyAssignedMinutes: 0,
          description: "",
          active: true,
          canWorkWeekends: true,
        },
      ];
    }
    if (values.educatorCount === 3 && configuration.educatorCount === 4) {
      const removedIds = new Set(
        configuration.educators.slice(3).map((item) => item.id),
      );
      const hasDependencies =
        configuration.assignmentOverrides.some((item) =>
          removedIds.has(item.educatorId),
        ) ||
        configuration.unavailability.some((item) =>
          removedIds.has(item.educatorId),
        ) ||
        configuration.weekendVariants.some(
          (variant) =>
            (variant.offEducatorId &&
              removedIds.has(variant.offEducatorId)) ||
            [
              ...variant.saturdayTemplate.assignments,
              ...variant.sundayTemplate.assignments,
            ].some((item) => removedIds.has(item.educatorId)),
        ) ||
        configuration.boundaryContext?.educators.some((item) =>
          removedIds.has(item.educatorId),
        );
      if (
        hasDependencies &&
        !window.confirm(
          "Czwarty wychowawca ma powiązane dane. Zmiana usunie jego niedostępności, przydziały, kontekst graniczny i odwołania we wzorcach weekendowych. Kontynuować?",
        )
      ) {
        reset({
          ...values,
          educatorCount: 4,
        });
        return;
      }
      educators = configuration.educators.slice(0, 3);
      assignmentOverrides = configuration.assignmentOverrides.filter(
        (item) => !removedIds.has(item.educatorId),
      );
      unavailability = configuration.unavailability.filter(
        (item) => !removedIds.has(item.educatorId),
      );
      weekendVariants = configuration.weekendVariants.map((variant) => ({
        ...variant,
        offEducatorId:
          variant.offEducatorId && removedIds.has(variant.offEducatorId)
            ? null
            : variant.offEducatorId,
        saturdayTemplate: {
          ...variant.saturdayTemplate,
          assignments: variant.saturdayTemplate.assignments.filter(
            (item) => !removedIds.has(item.educatorId),
          ),
        },
        sundayTemplate: {
          ...variant.sundayTemplate,
          assignments: variant.sundayTemplate.assignments.filter(
            (item) => !removedIds.has(item.educatorId),
          ),
        },
      }));
      boundaryContext = configuration.boundaryContext
        ? {
            educators: configuration.boundaryContext.educators.filter(
              (item) => !removedIds.has(item.educatorId),
            ),
          }
        : null;
    }

    setConfiguration({
      ...configuration,
      ...values,
      schemaVersion: 2,
      scheduleBoundaryMode:
        values.planningHorizonWeeks === 6
          ? values.scheduleBoundaryMode
          : "FINITE",
      educators,
      assignmentOverrides,
      unavailability,
      weekendVariants,
      boundaryContext,
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="KROK 02 · PODSTAWY"
        title="Konfiguracja podstawowa"
        description="Ustal liczbę osób, horyzont od jednego do sześciu tygodni oraz sposób traktowania granic harmonogramu."
      />
      {configuration.requestedOperationMode === "DEMONSTRATION" && (
        <DemoNotice>{configuration.demonstrationNotice}</DemoNotice>
      )}
      <form className="form-card" onSubmit={handleSubmit(submit)} noValidate>
        <div className="form-grid form-grid--two">
          <label>
            Nazwa projektu
            <input {...register("projectName")} />
            {errors.projectName && <em>{errors.projectName.message}</em>}
          </label>
          <label>
            Nazwa grupy
            <input {...register("groupName")} />
            {errors.groupName && <em>{errors.groupName.message}</em>}
          </label>
          <label>
            Początek cyklu (poniedziałek)
            <input type="date" {...register("cycleStartDate")} />
            {errors.cycleStartDate && <em>{errors.cycleStartDate.message}</em>}
          </label>
          <label>
            Strefa czasu IANA
            <input {...register("timeZoneId")} />
            {errors.timeZoneId && <em>{errors.timeZoneId.message}</em>}
          </label>
          <label>
            Liczba wychowawców
            <select
              {...register("educatorCount", { valueAsNumber: true })}
            >
              <option value={3}>3 osoby</option>
              <option value={4}>4 osoby</option>
            </select>
          </label>
          <label>
            Horyzont planowania
            <select
              {...register("planningHorizonWeeks", { valueAsNumber: true })}
            >
              {[1, 2, 3, 4, 5, 6].map((value) => (
                <option key={value} value={value}>
                  {value}{" "}
                  {value === 1
                    ? "tydzień"
                    : value < 5
                      ? "tygodnie"
                      : "tygodni"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Granice harmonogramu
            <select {...register("scheduleBoundaryMode")}>
              <option value="FINITE">Skończony horyzont</option>
              <option value="CYCLIC" disabled={selectedHorizon !== 6}>
                Cykl powtarzalny (tylko 6 tygodni)
              </option>
            </select>
            {errors.scheduleBoundaryMode && (
              <em>{errors.scheduleBoundaryMode.message}</em>
            )}
          </label>
          <label>
            Początkowa pozycja weekendu
            <select
              {...register("startingWeekendVariant", { valueAsNumber: true })}
            >
              {[1, 2, 3, 4, 5, 6].map((value) => (
                <option key={value} value={value}>
                  Pozycja {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tryb operacji
            <select {...register("requestedOperationMode")}>
              <option value="DEMONSTRATION">Tryb demonstracyjny</option>
              <option value="PRODUCTION">Tryb rzeczywisty</option>
            </select>
          </label>
        </div>
        <p className="form-hint">
          Tryb rzeczywisty jest dostępny wyłącznie z kompletnym, ważnym
          profilem prawnym VERIFIED. W pozostałych przypadkach backend
          jednoznacznie blokuje publikację wyniku produkcyjnego.
        </p>
        <div className="profile-summary">
          <div>
            <small>Profil prawny</small>
            <strong>{configuration.legalRules.sourceTitle}</strong>
          </div>
          <StatusBadge value={configuration.legalRules.verificationStatus} />
        </div>
        <div className="form-footer">
          {isSubmitSuccessful && <span role="status">Zapisano lokalnie.</span>}
          <button className="button button--primary" type="submit">
            Zapisz konfigurację
          </button>
        </div>
      </form>
    </>
  );
}
