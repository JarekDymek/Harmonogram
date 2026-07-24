import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  DemoNotice,
  EmptyState,
  PageHeader,
  StatusBadge,
} from "../components/UI";
import { useAppState } from "../state/AppState";
import {
  formatPolishHours,
  hoursToMinutes,
  minutesToHours,
  parsePolishHours,
} from "../time";

const duration = (optional = false) =>
  z.string().refine(
    (value) => {
      if (optional && value.trim() === "") return true;
      try {
        parsePolishHours(value);
        return true;
      } catch {
        return false;
      }
    },
    "Podaj godziny w krokach co 0,5, np. 11 lub 35.",
  );

const schema = z
  .object({
    verificationStatus: z.enum(["UNVERIFIED", "VERIFIED", "EXPIRED"]),
    jurisdiction: z.string(),
    sourceTitle: z.string(),
    sourceSection: z.string(),
    sourceIdentifier: z.string(),
    version: z.string(),
    verificationNotes: z.string(),
    verifiedAt: z.string(),
    effectiveFrom: z.string(),
    effectiveTo: z.string(),
    approvedBy: z.string(),
    minimumDailyRestHours: duration(),
    minimumWeeklyRestHours: duration(),
    weeklyRestWindowType: z.enum([
      "FIXED_LOCAL_WEEK",
      "ROLLING_DURATION",
    ]),
    weeklyRestWindowLengthHours: duration(),
    weeklyRestWindowStepHours: duration(),
    weeklyRestAttributionMode: z.enum([
      "FULLY_CONTAINED",
      "INTERSECTION_WITH_WINDOW",
    ]),
    weeklyRestReuseAcrossWindowsAllowed: z.boolean(),
    weeklyRestExceptionEnabled: z.boolean(),
    weeklyRestExceptionMinimumHours: duration(true),
    weeklyRestExceptionMaximumOccurrencesPerCycle: z
      .number()
      .int()
      .nonnegative()
      .nullable(),
    weeklyRestExceptionMinimumGapHours: duration(true),
    weeklyRestCompensationRequired: z.boolean(),
    weeklyRestCompensationHours: duration(true),
    weeklyRestCompensationDeadlineHours: duration(true),
    maximumAbsoluteDailyWorkHours: duration(true),
    maximumAbsoluteSegmentHours: duration(true),
    preferredAfternoonHandoverTime: z.string(),
    preferredMaximumSegmentHours: duration(),
    preferredWeekendSplitHours: duration(),
    afternoonHandoverPenaltyWeight: z.number().int().nonnegative(),
    weekendImbalancePenaltyWeight: z.number().int().nonnegative(),
    splitDayPenaltyWeight: z.number().int().nonnegative(),
    longSegmentPenaltyWeight: z.number().int().nonnegative(),
    preferredUnavailabilityPenaltyWeight: z.number().int().nonnegative(),
  })
  .superRefine((value, context) => {
    const requireText = (field: keyof typeof value, message: string) => {
      const current = value[field];
      if (typeof current === "string" && !current.trim()) {
        context.addIssue({ code: "custom", path: [field], message });
      }
    };
    if (value.verificationStatus === "VERIFIED") {
      requireText("sourceTitle", "Profil VERIFIED wymaga tytułu źródła.");
      if (!value.sourceIdentifier.trim() && !value.sourceSection.trim()) {
        context.addIssue({
          code: "custom",
          path: ["sourceIdentifier"],
          message:
            "Podaj identyfikator źródła albo precyzyjną sekcję źródła.",
        });
      }
      requireText("verifiedAt", "Podaj datę i czas weryfikacji.");
      requireText("effectiveFrom", "Podaj datę początku obowiązywania.");
      requireText("approvedBy", "Podaj osobę zatwierdzającą.");
      requireText("version", "Podaj wersję profilu.");
    }
    if (value.weeklyRestExceptionEnabled) {
      for (const field of [
        "weeklyRestExceptionMinimumHours",
        "weeklyRestExceptionMinimumGapHours",
      ] as const) {
        requireText(field, "Włączony wyjątek wymaga tej wartości.");
      }
      if (
        value.weeklyRestExceptionMaximumOccurrencesPerCycle === null ||
        Number.isNaN(value.weeklyRestExceptionMaximumOccurrencesPerCycle)
      ) {
        context.addIssue({
          code: "custom",
          path: ["weeklyRestExceptionMaximumOccurrencesPerCycle"],
          message: "Podaj maksymalną liczbę wyjątków.",
        });
      }
    }
    if (value.weeklyRestCompensationRequired) {
      requireText(
        "weeklyRestCompensationHours",
        "Wymagana kompensacja musi mieć wymiar.",
      );
      requireText(
        "weeklyRestCompensationDeadlineHours",
        "Wymagana kompensacja musi mieć termin.",
      );
    }
  });

type Values = z.infer<typeof schema>;

const displayDuration = (minutes: number | null | undefined) =>
  minutes === null || minutes === undefined
    ? ""
    : formatPolishHours(minutesToHours(minutes));

const requiredMinutes = (value: string) =>
  hoursToMinutes(parsePolishHours(value));

const optionalMinutes = (value: string) =>
  value.trim() ? requiredMinutes(value) : null;

export function RulesPage() {
  const { configuration, setConfiguration } = useAppState();
  const {
    register,
    reset,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });
  const exceptionEnabled = watch("weeklyRestExceptionEnabled", false);
  const compensationRequired = watch(
    "weeklyRestCompensationRequired",
    false,
  );

  useEffect(() => {
    if (!configuration) return;
    const legal = configuration.legalRules;
    const org = configuration.organizationalRules;
    reset({
      verificationStatus: legal.verificationStatus,
      jurisdiction: legal.jurisdiction,
      sourceTitle: legal.sourceTitle,
      sourceSection: legal.sourceSection,
      sourceIdentifier: legal.sourceIdentifier,
      version: legal.version,
      verificationNotes: legal.verificationNotes,
      verifiedAt: legal.verifiedAt?.slice(0, 16) ?? "",
      effectiveFrom: legal.effectiveFrom ?? "",
      effectiveTo: legal.effectiveTo ?? "",
      approvedBy: legal.approvedBy ?? "",
      minimumDailyRestHours: displayDuration(
        legal.minimumDailyRestMinutes,
      ),
      minimumWeeklyRestHours: displayDuration(
        legal.minimumWeeklyRestMinutes,
      ),
      weeklyRestWindowType: legal.weeklyRestWindowType,
      weeklyRestWindowLengthHours: displayDuration(
        legal.weeklyRestWindowLengthMinutes,
      ),
      weeklyRestWindowStepHours: displayDuration(
        legal.weeklyRestWindowStepMinutes,
      ),
      weeklyRestAttributionMode: legal.weeklyRestAttributionMode,
      weeklyRestReuseAcrossWindowsAllowed:
        legal.weeklyRestReuseAcrossWindowsAllowed,
      weeklyRestExceptionEnabled: legal.weeklyRestExceptionEnabled,
      weeklyRestExceptionMinimumHours: displayDuration(
        legal.weeklyRestExceptionMinimumMinutes,
      ),
      weeklyRestExceptionMaximumOccurrencesPerCycle:
        legal.weeklyRestExceptionMaximumOccurrencesPerCycle ?? null,
      weeklyRestExceptionMinimumGapHours: displayDuration(
        legal.weeklyRestExceptionMinimumGapMinutes,
      ),
      weeklyRestCompensationRequired:
        legal.weeklyRestCompensationRequired,
      weeklyRestCompensationHours: displayDuration(
        legal.weeklyRestCompensationMinutes,
      ),
      weeklyRestCompensationDeadlineHours: displayDuration(
        legal.weeklyRestCompensationDeadlineMinutes,
      ),
      maximumAbsoluteDailyWorkHours: displayDuration(
        legal.maximumAbsoluteDailyWorkMinutes,
      ),
      maximumAbsoluteSegmentHours: displayDuration(
        legal.maximumAbsoluteSegmentMinutes,
      ),
      preferredAfternoonHandoverTime:
        org.preferredAfternoonHandoverTime,
      preferredMaximumSegmentHours: displayDuration(
        org.preferredMaximumSegmentMinutes,
      ),
      preferredWeekendSplitHours: displayDuration(
        org.preferredWeekendSplitMinutes,
      ),
      afternoonHandoverPenaltyWeight:
        org.afternoonHandoverPenaltyWeight,
      weekendImbalancePenaltyWeight:
        org.weekendImbalancePenaltyWeight,
      splitDayPenaltyWeight: org.splitDayPenaltyWeight,
      longSegmentPenaltyWeight: org.longSegmentPenaltyWeight,
      preferredUnavailabilityPenaltyWeight:
        org.preferredUnavailabilityPenaltyWeight,
    });
  }, [configuration, reset]);

  if (!configuration) {
    return <EmptyState>Najpierw utwórz konfigurację.</EmptyState>;
  }

  const submit = (values: Values) => {
    setConfiguration({
      ...configuration,
      legalRules: {
        ...configuration.legalRules,
        verificationStatus: values.verificationStatus,
        jurisdiction: values.jurisdiction,
        sourceTitle: values.sourceTitle,
        sourceSection: values.sourceSection,
        sourceIdentifier: values.sourceIdentifier,
        version: values.version,
        verificationNotes: values.verificationNotes,
        verifiedAt: values.verifiedAt
          ? new Date(values.verifiedAt).toISOString()
          : null,
        effectiveFrom: values.effectiveFrom || null,
        effectiveTo: values.effectiveTo || null,
        approvedBy: values.approvedBy || null,
        minimumDailyRestMinutes: requiredMinutes(
          values.minimumDailyRestHours,
        ),
        minimumWeeklyRestMinutes: requiredMinutes(
          values.minimumWeeklyRestHours,
        ),
        weeklyRestWindowType: values.weeklyRestWindowType,
        weeklyRestWindowLengthMinutes: requiredMinutes(
          values.weeklyRestWindowLengthHours,
        ),
        weeklyRestWindowStepMinutes: requiredMinutes(
          values.weeklyRestWindowStepHours,
        ),
        weeklyRestAttributionMode: values.weeklyRestAttributionMode,
        weeklyRestReuseAcrossWindowsAllowed:
          values.weeklyRestReuseAcrossWindowsAllowed,
        weeklyRestExceptionEnabled: values.weeklyRestExceptionEnabled,
        weeklyRestExceptionMinimumMinutes:
          values.weeklyRestExceptionEnabled
            ? optionalMinutes(values.weeklyRestExceptionMinimumHours)
            : null,
        weeklyRestExceptionMaximumOccurrencesPerCycle:
          values.weeklyRestExceptionEnabled
            ? values.weeklyRestExceptionMaximumOccurrencesPerCycle
            : null,
        weeklyRestExceptionMinimumGapMinutes:
          values.weeklyRestExceptionEnabled
            ? optionalMinutes(values.weeklyRestExceptionMinimumGapHours)
            : null,
        weeklyRestCompensationRequired:
          values.weeklyRestCompensationRequired,
        weeklyRestCompensationMinutes:
          values.weeklyRestCompensationRequired
            ? optionalMinutes(values.weeklyRestCompensationHours)
            : null,
        weeklyRestCompensationDeadlineMinutes:
          values.weeklyRestCompensationRequired
            ? optionalMinutes(values.weeklyRestCompensationDeadlineHours)
            : null,
        maximumAbsoluteDailyWorkMinutes: optionalMinutes(
          values.maximumAbsoluteDailyWorkHours,
        ),
        maximumAbsoluteSegmentMinutes: optionalMinutes(
          values.maximumAbsoluteSegmentHours,
        ),
      },
      organizationalRules: {
        ...configuration.organizationalRules,
        preferredAfternoonHandoverTime:
          values.preferredAfternoonHandoverTime,
        preferredMaximumSegmentMinutes: requiredMinutes(
          values.preferredMaximumSegmentHours,
        ),
        preferredWeekendSplitMinutes: requiredMinutes(
          values.preferredWeekendSplitHours,
        ),
        afternoonHandoverPenaltyWeight:
          values.afternoonHandoverPenaltyWeight,
        weekendImbalancePenaltyWeight:
          values.weekendImbalancePenaltyWeight,
        splitDayPenaltyWeight: values.splitDayPenaltyWeight,
        longSegmentPenaltyWeight: values.longSegmentPenaltyWeight,
        preferredUnavailabilityPenaltyWeight:
          values.preferredUnavailabilityPenaltyWeight,
      },
    });
  };

  const hourInput = (name: keyof Values, disabled = false) => (
    <input
      type="text"
      inputMode="decimal"
      step="0.5"
      disabled={disabled}
      {...register(name)}
    />
  );
  const fieldError = (name: keyof Values) => {
    const message = errors[name]?.message;
    return message ? <em>{String(message)}</em> : null;
  };

  return (
    <>
      <PageHeader
        eyebrow="KROK 06 · OGRANICZENIA"
        title="Reguły organizacyjne i profil prawny"
        description="Możesz zapisać kompletny profil VERIFIED. Backend dopuści tryb rzeczywisty tylko wtedy, gdy pełny ślad i okres obowiązywania przejdą walidację."
      />
      <div className="profile-banner">
        <div>
          <span className="eyebrow">
            PROFIL {configuration.legalRules.version}
          </span>
          <h2>{configuration.legalRules.sourceTitle}</h2>
          <p>{configuration.legalRules.verificationNotes}</p>
        </div>
        <StatusBadge value={configuration.legalRules.verificationStatus} />
      </div>
      {configuration.legalRules.verificationStatus !== "VERIFIED" && (
        <DemoNotice />
      )}
      <form className="stack" onSubmit={handleSubmit(submit)} noValidate>
        <section className="form-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ŚLAD PRAWNY</span>
              <h2>Źródło, ważność i zatwierdzenie</h2>
            </div>
          </div>
          <div className="form-grid form-grid--three legal-trace">
            <label>
              Status weryfikacji
              <select {...register("verificationStatus")}>
                <option value="UNVERIFIED">UNVERIFIED</option>
                <option value="VERIFIED">VERIFIED</option>
                <option value="EXPIRED">EXPIRED</option>
              </select>
            </label>
            <label>
              Jurysdykcja
              <input {...register("jurisdiction")} />
            </label>
            <label>
              Wersja profilu
              <input {...register("version")} />
              {fieldError("version")}
            </label>
            <label>
              Tytuł źródła
              <input {...register("sourceTitle")} />
              {fieldError("sourceTitle")}
            </label>
            <label>
              Identyfikator źródła
              <input {...register("sourceIdentifier")} />
              {fieldError("sourceIdentifier")}
            </label>
            <label>
              Sekcja źródła
              <input {...register("sourceSection")} />
            </label>
            <label>
              Zweryfikowano
              <input type="datetime-local" {...register("verifiedAt")} />
              {fieldError("verifiedAt")}
            </label>
            <label>
              Obowiązuje od
              <input type="date" {...register("effectiveFrom")} />
              {fieldError("effectiveFrom")}
            </label>
            <label>
              Obowiązuje do (opcjonalnie)
              <input type="date" {...register("effectiveTo")} />
            </label>
            <label>
              Zatwierdził(a)
              <input {...register("approvedBy")} />
              {fieldError("approvedBy")}
            </label>
            <label className="inline-form__wide">
              Notatki weryfikacyjne
              <textarea rows={3} {...register("verificationNotes")} />
            </label>
          </div>
        </section>

        <section className="form-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ODPOCZYNKI</span>
              <h2>Twarde reguły w godzinach</h2>
            </div>
          </div>
          <p className="form-hint">
            Wszystkie wartości czasu podawaj w godzinach. Przykład: 11
            oznacza 11 godzin, a 11,5 oznacza 11 godzin i 30 minut.
          </p>
          <div className="form-grid form-grid--three">
            <label>
              Odpoczynek dobowy
              {hourInput("minimumDailyRestHours")}
              {fieldError("minimumDailyRestHours")}
            </label>
            <label>
              Odpoczynek tygodniowy
              {hourInput("minimumWeeklyRestHours")}
              {fieldError("minimumWeeklyRestHours")}
            </label>
            <label>
              Typ okna
              <select {...register("weeklyRestWindowType")}>
                <option value="FIXED_LOCAL_WEEK">
                  Stały tydzień lokalny
                </option>
                <option value="ROLLING_DURATION">Okno kroczące</option>
              </select>
            </label>
            <label>
              Długość okna
              {hourInput("weeklyRestWindowLengthHours")}
              {fieldError("weeklyRestWindowLengthHours")}
            </label>
            <label>
              Krok okna
              {hourInput("weeklyRestWindowStepHours")}
              {fieldError("weeklyRestWindowStepHours")}
            </label>
            <label>
              Kotwica
              <input
                value={`${configuration.legalRules.weeklyRestAnchorDayOfWeek} · ${configuration.legalRules.weeklyRestAnchorTime}`}
                readOnly
              />
            </label>
            <label>
              Sposób przypisania
              <select {...register("weeklyRestAttributionMode")}>
                <option value="INTERSECTION_WITH_WINDOW">
                  Część wspólna z oknem
                </option>
                <option value="FULLY_CONTAINED">
                  W całości w oknie
                </option>
              </select>
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                {...register("weeklyRestReuseAcrossWindowsAllowed")}
              />
              Ten sam odpoczynek może obsłużyć kilka okien
            </label>
            <label>
              Bezwzględny limit dzienny (opcjonalnie)
              {hourInput("maximumAbsoluteDailyWorkHours")}
              {fieldError("maximumAbsoluteDailyWorkHours")}
            </label>
            <label>
              Bezwzględny limit odcinka (opcjonalnie)
              {hourInput("maximumAbsoluteSegmentHours")}
              {fieldError("maximumAbsoluteSegmentHours")}
            </label>
          </div>
        </section>

        <section className="form-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">WYJĄTKI</span>
              <h2>Wyjątek i kompensacja</h2>
            </div>
          </div>
          <div className="form-grid form-grid--three">
            <label className="check-field">
              <input
                type="checkbox"
                {...register("weeklyRestExceptionEnabled")}
              />
              Włącz wyjątek odpoczynku tygodniowego
            </label>
            <label>
              Minimum wyjątku
              {hourInput(
                "weeklyRestExceptionMinimumHours",
                !exceptionEnabled,
              )}
              {fieldError("weeklyRestExceptionMinimumHours")}
            </label>
            <label>
              Maksymalna liczba wyjątków
              <input
                type="number"
                min="0"
                disabled={!exceptionEnabled}
                {...register(
                  "weeklyRestExceptionMaximumOccurrencesPerCycle",
                  {
                    setValueAs: (value) =>
                      value === "" ? null : Number(value),
                  },
                )}
              />
              {fieldError(
                "weeklyRestExceptionMaximumOccurrencesPerCycle",
              )}
            </label>
            <label>
              Minimalny odstęp wyjątków
              {hourInput(
                "weeklyRestExceptionMinimumGapHours",
                !exceptionEnabled,
              )}
              {fieldError("weeklyRestExceptionMinimumGapHours")}
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                {...register("weeklyRestCompensationRequired")}
              />
              Wymagaj kompensacji
            </label>
            <label>
              Wymiar kompensacji
              {hourInput(
                "weeklyRestCompensationHours",
                !compensationRequired,
              )}
              {fieldError("weeklyRestCompensationHours")}
            </label>
            <label>
              Termin kompensacji
              {hourInput(
                "weeklyRestCompensationDeadlineHours",
                !compensationRequired,
              )}
              {fieldError("weeklyRestCompensationDeadlineHours")}
            </label>
          </div>
        </section>

        <section className="form-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">FUNKCJA CELU</span>
              <h2>Preferencje i jawne wagi</h2>
            </div>
          </div>
          <div className="form-grid form-grid--three">
            <label>
              Preferowane przekazanie
              <input
                type="time"
                {...register("preferredAfternoonHandoverTime")}
              />
            </label>
            <label>
              Preferowany maksymalny odcinek
              {hourInput("preferredMaximumSegmentHours")}
              {fieldError("preferredMaximumSegmentHours")}
            </label>
            <label>
              Preferowany podział weekendu
              {hourInput("preferredWeekendSplitHours")}
              {fieldError("preferredWeekendSplitHours")}
            </label>
            {[
              ["afternoonHandoverPenaltyWeight", "Waga: przekazanie"],
              ["weekendImbalancePenaltyWeight", "Waga: weekend"],
              ["splitDayPenaltyWeight", "Waga: dni dzielone"],
              ["longSegmentPenaltyWeight", "Waga: długie odcinki"],
              [
                "preferredUnavailabilityPenaltyWeight",
                "Waga: PREFERRED",
              ],
            ].map(([name, label]) => (
              <label key={name}>
                {label}
                <input
                  type="number"
                  min="0"
                  {...register(name as keyof Values, {
                    valueAsNumber: true,
                  })}
                />
              </label>
            ))}
          </div>
        </section>
        <div className="align-right">
          <button className="button button--primary" type="submit">
            Zapisz reguły
          </button>
        </div>
      </form>
    </>
  );
}
