import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DemoNotice, EmptyState, PageHeader, StatusBadge } from "../components/UI";
import { useAppState } from "../state/AppState";

const schema = z.object({
  verificationStatus: z.enum(["UNVERIFIED", "VERIFIED", "EXPIRED"]),
  sourceTitle: z.string().min(1),
  sourceIdentifier: z.string().min(1),
  verifiedAt: z.string(),
  effectiveFrom: z.string(),
  effectiveTo: z.string(),
  approvedBy: z.string(),
  minimumDailyRestMinutes: z.number().int().nonnegative(),
  minimumWeeklyRestMinutes: z.number().int().nonnegative(),
  weeklyRestWindowType: z.enum(["FIXED_LOCAL_WEEK", "ROLLING_DURATION"]),
  weeklyRestWindowLengthMinutes: z.number().int().positive(),
  weeklyRestWindowStepMinutes: z.number().int().positive(),
  weeklyRestAttributionMode: z.enum([
    "FULLY_CONTAINED",
    "INTERSECTION_WITH_WINDOW",
  ]),
  weeklyRestReuseAcrossWindowsAllowed: z.boolean(),
  weeklyRestExceptionEnabled: z.boolean(),
  weeklyRestExceptionMinimumMinutes: z.number().int().nonnegative().nullable(),
  weeklyRestExceptionMaximumOccurrencesPerCycle: z
    .number()
    .int()
    .nonnegative()
    .nullable(),
  weeklyRestExceptionMinimumGapMinutes: z
    .number()
    .int()
    .nonnegative()
    .nullable(),
  weeklyRestCompensationRequired: z.boolean(),
  weeklyRestCompensationMinutes: z.number().int().nonnegative().nullable(),
  weeklyRestCompensationDeadlineMinutes: z
    .number()
    .int()
    .nonnegative()
    .nullable(),
  preferredAfternoonHandoverTime: z.string(),
  preferredMaximumSegmentMinutes: z.number().int().nonnegative(),
  preferredWeekendSplitMinutes: z.number().int().nonnegative(),
  afternoonHandoverPenaltyWeight: z.number().int().nonnegative(),
  weekendImbalancePenaltyWeight: z.number().int().nonnegative(),
  splitDayPenaltyWeight: z.number().int().nonnegative(),
  longSegmentPenaltyWeight: z.number().int().nonnegative(),
  preferredUnavailabilityPenaltyWeight: z.number().int().nonnegative(),
});
type Values = z.infer<typeof schema>;

export function RulesPage() {
  const { configuration, setConfiguration } = useAppState();
  const { register, reset, handleSubmit } = useForm<Values>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (configuration) {
      reset({
        verificationStatus: configuration.legalRules.verificationStatus,
        sourceTitle: configuration.legalRules.sourceTitle,
        sourceIdentifier: configuration.legalRules.sourceIdentifier,
        verifiedAt: configuration.legalRules.verifiedAt?.slice(0, 16) ?? "",
        effectiveFrom: configuration.legalRules.effectiveFrom ?? "",
        effectiveTo: configuration.legalRules.effectiveTo ?? "",
        approvedBy: configuration.legalRules.approvedBy ?? "",
        minimumDailyRestMinutes:
          configuration.legalRules.minimumDailyRestMinutes,
        minimumWeeklyRestMinutes:
          configuration.legalRules.minimumWeeklyRestMinutes,
        weeklyRestWindowType:
          configuration.legalRules.weeklyRestWindowType,
        weeklyRestWindowLengthMinutes:
          configuration.legalRules.weeklyRestWindowLengthMinutes,
        weeklyRestWindowStepMinutes:
          configuration.legalRules.weeklyRestWindowStepMinutes,
        weeklyRestAttributionMode:
          configuration.legalRules.weeklyRestAttributionMode,
        weeklyRestReuseAcrossWindowsAllowed:
          configuration.legalRules.weeklyRestReuseAcrossWindowsAllowed,
        weeklyRestExceptionEnabled:
          configuration.legalRules.weeklyRestExceptionEnabled,
        weeklyRestExceptionMinimumMinutes:
          configuration.legalRules.weeklyRestExceptionMinimumMinutes ?? null,
        weeklyRestExceptionMaximumOccurrencesPerCycle:
          configuration.legalRules
            .weeklyRestExceptionMaximumOccurrencesPerCycle ?? null,
        weeklyRestExceptionMinimumGapMinutes:
          configuration.legalRules.weeklyRestExceptionMinimumGapMinutes ?? null,
        weeklyRestCompensationRequired:
          configuration.legalRules.weeklyRestCompensationRequired,
        weeklyRestCompensationMinutes:
          configuration.legalRules.weeklyRestCompensationMinutes ?? null,
        weeklyRestCompensationDeadlineMinutes:
          configuration.legalRules.weeklyRestCompensationDeadlineMinutes ??
          null,
        preferredAfternoonHandoverTime:
          configuration.organizationalRules.preferredAfternoonHandoverTime,
        preferredMaximumSegmentMinutes:
          configuration.organizationalRules.preferredMaximumSegmentMinutes,
        preferredWeekendSplitMinutes:
          configuration.organizationalRules.preferredWeekendSplitMinutes,
        afternoonHandoverPenaltyWeight:
          configuration.organizationalRules.afternoonHandoverPenaltyWeight,
        weekendImbalancePenaltyWeight:
          configuration.organizationalRules.weekendImbalancePenaltyWeight,
        splitDayPenaltyWeight:
          configuration.organizationalRules.splitDayPenaltyWeight,
        longSegmentPenaltyWeight:
          configuration.organizationalRules.longSegmentPenaltyWeight,
        preferredUnavailabilityPenaltyWeight:
          configuration.organizationalRules
            .preferredUnavailabilityPenaltyWeight,
      });
    }
  }, [configuration, reset]);

  if (!configuration) return <EmptyState>Najpierw utwórz konfigurację.</EmptyState>;

  const submit = (values: Values) => {
    setConfiguration({
      ...configuration,
      legalRules: {
        ...configuration.legalRules,
        verificationStatus: values.verificationStatus,
        sourceTitle: values.sourceTitle,
        sourceIdentifier: values.sourceIdentifier,
        verifiedAt: values.verifiedAt
          ? new Date(values.verifiedAt).toISOString()
          : null,
        effectiveFrom: values.effectiveFrom || null,
        effectiveTo: values.effectiveTo || null,
        approvedBy: values.approvedBy || null,
        minimumDailyRestMinutes: values.minimumDailyRestMinutes,
        minimumWeeklyRestMinutes: values.minimumWeeklyRestMinutes,
        weeklyRestWindowType: values.weeklyRestWindowType,
        weeklyRestWindowLengthMinutes: values.weeklyRestWindowLengthMinutes,
        weeklyRestWindowStepMinutes: values.weeklyRestWindowStepMinutes,
        weeklyRestAttributionMode: values.weeklyRestAttributionMode,
        weeklyRestReuseAcrossWindowsAllowed:
          values.weeklyRestReuseAcrossWindowsAllowed,
        weeklyRestExceptionEnabled: values.weeklyRestExceptionEnabled,
        weeklyRestExceptionMinimumMinutes:
          values.weeklyRestExceptionEnabled
            ? values.weeklyRestExceptionMinimumMinutes
            : null,
        weeklyRestExceptionMaximumOccurrencesPerCycle:
          values.weeklyRestExceptionEnabled
            ? values.weeklyRestExceptionMaximumOccurrencesPerCycle
            : null,
        weeklyRestExceptionMinimumGapMinutes:
          values.weeklyRestExceptionEnabled
            ? values.weeklyRestExceptionMinimumGapMinutes
            : null,
        weeklyRestCompensationRequired:
          values.weeklyRestCompensationRequired,
        weeklyRestCompensationMinutes:
          values.weeklyRestCompensationRequired
            ? values.weeklyRestCompensationMinutes
            : null,
        weeklyRestCompensationDeadlineMinutes:
          values.weeklyRestCompensationRequired
            ? values.weeklyRestCompensationDeadlineMinutes
            : null,
      },
      organizationalRules: {
        ...configuration.organizationalRules,
        preferredAfternoonHandoverTime:
          values.preferredAfternoonHandoverTime,
        preferredMaximumSegmentMinutes:
          values.preferredMaximumSegmentMinutes,
        preferredWeekendSplitMinutes: values.preferredWeekendSplitMinutes,
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

  return (
    <>
      <PageHeader
        eyebrow="KROK 06 · OGRANICZENIA"
        title="Reguły organizacyjne i profil prawny"
        description="Aplikacja stosuje zapisane wartości. Nie interpretuje prawa i nie nadaje profilowi statusu VERIFIED."
      />
      <div className="profile-banner">
        <div>
          <span className="eyebrow">PROFIL {configuration.legalRules.version}</span>
          <h2>{configuration.legalRules.sourceTitle}</h2>
          <p>{configuration.legalRules.verificationNotes}</p>
        </div>
        <StatusBadge value={configuration.legalRules.verificationStatus} />
      </div>
      {configuration.legalRules.verificationStatus !== "VERIFIED" && <DemoNotice />}
      <form className="stack" onSubmit={handleSubmit(submit)}>
        <section className="form-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">PROFIL PRAWNY</span>
              <h2>Odpoczynki i okna kontroli</h2>
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
              Tytuł źródła
              <input {...register("sourceTitle")} />
            </label>
            <label>
              Identyfikator źródła
              <input {...register("sourceIdentifier")} />
            </label>
            <label>
              Zweryfikowano
              <input type="datetime-local" {...register("verifiedAt")} />
            </label>
            <label>
              Obowiązuje od
              <input type="date" {...register("effectiveFrom")} />
            </label>
            <label>
              Obowiązuje do
              <input type="date" {...register("effectiveTo")} />
            </label>
            <label>
              Zatwierdził(a)
              <input {...register("approvedBy")} />
            </label>
          </div>
          <div className="form-grid form-grid--three">
            <label>
              Odpoczynek dobowy (min)
              <input
                type="number"
                {...register("minimumDailyRestMinutes", { valueAsNumber: true })}
              />
            </label>
            <label>
              Odpoczynek tygodniowy (min)
              <input
                type="number"
                {...register("minimumWeeklyRestMinutes", { valueAsNumber: true })}
              />
            </label>
            <label>
              Typ okna
              <select {...register("weeklyRestWindowType")}>
                <option value="FIXED_LOCAL_WEEK">Stały tydzień lokalny</option>
                <option value="ROLLING_DURATION">Okno kroczące</option>
              </select>
            </label>
            <label>
              Długość okna (min)
              <input
                type="number"
                {...register("weeklyRestWindowLengthMinutes", {
                  valueAsNumber: true,
                })}
              />
            </label>
            <label>
              Krok okna (min)
              <input
                type="number"
                {...register("weeklyRestWindowStepMinutes", {
                  valueAsNumber: true,
                })}
              />
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
                <option value="FULLY_CONTAINED">W całości w oknie</option>
              </select>
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                {...register("weeklyRestReuseAcrossWindowsAllowed")}
              />
              Ten sam odpoczynek może obsłużyć kilka okien
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                {...register("weeklyRestExceptionEnabled")}
              />
              Włącz wyjątek odpoczynku tygodniowego
            </label>
            <label>
              Minimum wyjątku (min)
              <input
                type="number"
                {...register("weeklyRestExceptionMinimumMinutes", {
                  setValueAs: (value) =>
                    value === "" ? null : Number(value),
                })}
              />
            </label>
            <label>
              Maks. wyjątków w cyklu
              <input
                type="number"
                {...register(
                  "weeklyRestExceptionMaximumOccurrencesPerCycle",
                  {
                    setValueAs: (value) =>
                      value === "" ? null : Number(value),
                  },
                )}
              />
            </label>
            <label>
              Min. odstęp wyjątków (min)
              <input
                type="number"
                {...register("weeklyRestExceptionMinimumGapMinutes", {
                  setValueAs: (value) =>
                    value === "" ? null : Number(value),
                })}
              />
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                {...register("weeklyRestCompensationRequired")}
              />
              Wymagaj kompensacji
            </label>
            <label>
              Wymiar kompensacji (min)
              <input
                type="number"
                {...register("weeklyRestCompensationMinutes", {
                  setValueAs: (value) =>
                    value === "" ? null : Number(value),
                })}
              />
            </label>
            <label>
              Termin kompensacji (min)
              <input
                type="number"
                {...register("weeklyRestCompensationDeadlineMinutes", {
                  setValueAs: (value) =>
                    value === "" ? null : Number(value),
                })}
              />
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
              <input type="time" {...register("preferredAfternoonHandoverTime")} />
            </label>
            <label>
              Preferowany maks. odcinek (min)
              <input
                type="number"
                {...register("preferredMaximumSegmentMinutes", {
                  valueAsNumber: true,
                })}
              />
            </label>
            <label>
              Preferowany podział weekendu (min)
              <input
                type="number"
                {...register("preferredWeekendSplitMinutes", {
                  valueAsNumber: true,
                })}
              />
            </label>
            <label>
              Waga: przekazanie
              <input
                type="number"
                {...register("afternoonHandoverPenaltyWeight", {
                  valueAsNumber: true,
                })}
              />
            </label>
            <label>
              Waga: weekend
              <input
                type="number"
                {...register("weekendImbalancePenaltyWeight", {
                  valueAsNumber: true,
                })}
              />
            </label>
            <label>
              Waga: dni dzielone
              <input
                type="number"
                {...register("splitDayPenaltyWeight", { valueAsNumber: true })}
              />
            </label>
            <label>
              Waga: długie odcinki
              <input
                type="number"
                {...register("longSegmentPenaltyWeight", { valueAsNumber: true })}
              />
            </label>
            <label>
              Waga: PREFERRED
              <input
                type="number"
                {...register("preferredUnavailabilityPenaltyWeight", {
                  valueAsNumber: true,
                })}
              />
            </label>
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
