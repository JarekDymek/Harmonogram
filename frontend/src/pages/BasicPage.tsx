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
});
type FormValues = z.infer<typeof schema>;

export function BasicPage() {
  const { configuration, setConfiguration } = useAppState();
  const {
    register,
    reset,
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

  const submit = (values: FormValues) => {
    setConfiguration({ ...configuration, ...values });
  };

  return (
    <>
      <PageHeader
        eyebrow="KROK 02 · PODSTAWY"
        title="Konfiguracja podstawowa"
        description="Kotwica cyklu, grupa i tryb działania są wspólne dla wszystkich 42 dat."
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
              <option value="DEMONSTRATION">Demonstracyjny</option>
              <option value="PRODUCTION">Produkcyjny</option>
            </select>
          </label>
        </div>
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
