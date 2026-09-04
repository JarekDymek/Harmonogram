import { SectionTiles } from "../components/SectionTiles";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DemoNotice, EmptyState, PageHeader, StatusBadge } from "../components/UI";
import { useAppState } from "../state/AppState";
import { addBlankGroup, GROUP_CODES } from "../groups";
import { GroupImport } from "../components/GroupImport";

const schema = z
  .object({
    projectName: z.string().min(3, "Podaj nazwę projektu."),
    groupName: z.string().min(2, "Podaj nazwę grupy."),
    groupCode: z.string().min(1, "Podaj oznaczenie grupy."),
    classLabel: z.string(),
    cycleStartDate: z.string().min(1, "Wybierz datę."),
    timeZoneId: z.string().min(3, "Podaj strefę IANA."),
    startingWeekendVariant: z.number().int().min(1).max(6),
    requestedOperationMode: z.enum(["PRODUCTION", "DEMONSTRATION"]),
    educatorCount: z.union([z.literal(3), z.literal(4)]),
    planningHorizonWeeks: z.number().int().min(1).max(6),
    scheduleBoundaryMode: z.enum(["FINITE", "CYCLIC"]),
  })
  .superRefine((value, context) => {
    if (value.scheduleBoundaryMode === "CYCLIC" && value.planningHorizonWeeks !== 6) {
      context.addIssue({
        code: "custom",
        path: ["scheduleBoundaryMode"],
        message: "Tryb cykliczny wymaga dokładnie sześciu tygodni.",
      });
    }
  });
type FormValues = z.infer<typeof schema>;

export function BasicPage() {
  const { configuration, setConfiguration, setSelectedGroups, busy } = useAppState();
  const [newCode, setNewCode] = useState("");
  const [groupMessage, setGroupMessage] = useState("");
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const { register, reset, watch, handleSubmit, formState: { errors, isSubmitSuccessful } } = form;

  useEffect(() => {
    if (!configuration) return;
    const group = configuration.groups.find(
      (item) => item.id === configuration.activeGroupId,
    )!;
    reset({
      projectName: configuration.projectName,
      groupName: group.name,
      groupCode: group.code,
      classLabel: group.classLabel,
      cycleStartDate: configuration.cycleStartDate,
      timeZoneId: configuration.timeZoneId,
      startingWeekendVariant: configuration.startingWeekendVariant,
      requestedOperationMode: configuration.requestedOperationMode,
      educatorCount: configuration.educatorCount,
      planningHorizonWeeks: configuration.planningHorizonWeeks,
      scheduleBoundaryMode: configuration.scheduleBoundaryMode,
    });
  }, [configuration, reset]);

  if (!configuration) {
    return <EmptyState>Wróć na stronę startową i utwórz konfigurację albo wczytaj demonstrację.</EmptyState>;
  }

  const selectedHorizon = watch("planningHorizonWeeks", configuration.planningHorizonWeeks);

  const submit = (values: FormValues) => {
    let next = structuredClone(configuration);
    if (next.groups.some(g => g.id !== next.activeGroupId && g.code.trim().toUpperCase() === values.groupCode.trim().toUpperCase())) {
      form.setError("groupCode", {message: "To oznaczenie ma już inna grupa."}); return;
    }
    const group = next.groups.find((item) => item.id === next.activeGroupId)!;
    group.name = values.groupName;
    group.code = values.groupCode;
    group.classLabel = values.classLabel;
    const currentMembers = next.groupMemberships.filter(
      (item) => item.groupId === group.id && item.active,
    );
    if (values.educatorCount === 4 && currentMembers.length === 3) {
      const educatorId = `EDU-${crypto.randomUUID()}`;
      next.educators.push({
        id: educatorId,
        groupId: null,
        displayName: "Nowy wychowawca uzupełniający",
        shortCode: "W4",
        baseWeeklyAssignedMinutes: 0,
        description: "",
        active: true,
        canWorkWeekends: true,
      });
      next.groupMemberships.push({
        id: crypto.randomUUID(),
        groupId: group.id,
        educatorId,
        role: "SUPPORT",
        active: true,
        weeklyTargetHoursByWeek: [0],
        description: "",
      });
    }
    if (values.educatorCount === 3 && currentMembers.length === 4) {
      const removed = currentMembers[3];
      const hasDependencies =
        next.unavailability.some((item) => item.educatorId === removed.educatorId) ||
        next.weekendVariants.some(
          (variant) =>
            variant.groupId === group.id &&
            [...variant.saturdayTemplate.assignments, ...variant.sundayTemplate.assignments].some(
              (item) => item.educatorId === removed.educatorId,
            ),
        );
      if (hasDependencies && !window.confirm("Czwarty wychowawca ma powiązane dane. Usunąć członkostwo?")) return;
      next.groupMemberships = next.groupMemberships.filter(
        (item) => item.id !== removed.id,
      );
      const usedElsewhere = next.groupMemberships.some(
        (item) => item.educatorId === removed.educatorId,
      );
      if (!usedElsewhere) {
        next.educators = next.educators.filter((item) => item.id !== removed.educatorId);
        next.unavailability = next.unavailability.filter(
          (item) => item.educatorId !== removed.educatorId,
        );
      }
    }
    next = {
      ...next,
      ...values,
      schemaVersion: 3,
      groupId: group.id,
      groupName: group.name,
      scheduleBoundaryMode:
        values.planningHorizonWeeks === 6 ? values.scheduleBoundaryMode : "FINITE",
    };
    setConfiguration(next);
  };

  const toggleSelected = (groupId: string, checked: boolean) => {
    if (form.formState.isDirty) { setGroupMessage("Najpierw zapisz zmiany konfiguracji. Wybór grup nie skasuje niezapisanych pól."); return; }
    const selected = checked
      ? [...new Set([...configuration.selectedGroupIds, groupId])]
      : configuration.selectedGroupIds.filter((id) => id !== groupId);
    setSelectedGroups(selected);
  };

  const addGroup = () => {
    if (form.formState.isDirty) { setGroupMessage("Najpierw zapisz zmiany konfiguracji, potem dodaj grupę. Niezapisane pola pozostają w formularzu."); return; }
    try { setConfiguration(addBlankGroup(configuration, newCode)); setGroupMessage(`Dodano pustą grupę ${newCode}. Uzupełnij jej osoby, plan pobytu i weekendy. Pozostałe grupy pozostają bez zmian.`); setNewCode(""); }
    catch (error) { setGroupMessage(error instanceof Error ? error.message : "Nie dodano grupy."); }
  };

  return (
    <SectionTiles>
      <PageHeader
        eyebrow="KROK 02 · PROJEKT INTERNATU"
        title="Konfiguracja podstawowa"
        description="Ustal 1–8 grup, zakres wspólnego generowania oraz parametry aktywnej grupy."
      />
      {configuration.requestedOperationMode === "DEMONSTRATION" && (
        <DemoNotice>{configuration.demonstrationNotice}</DemoNotice>
      )}
      <form className="form-card" onSubmit={handleSubmit(submit)} noValidate>
        <div className="form-grid form-grid--two">
          <label>Nazwa projektu<input {...register("projectName")} />{errors.projectName && <em>{errors.projectName.message}</em>}</label>
          <p>Grupy zapisane w projekcie: {configuration.groups.map(g => g.code).join(", ")}. Zakres obliczeń wybierasz poniżej — odłączenie nie usuwa danych.</p>
          <label>Nazwa grupy<input {...register("groupName")} />{errors.groupName && <em>{errors.groupName.message}</em>}</label>
          <label>Oznaczenie grupy<input {...register("groupCode")} />{errors.groupCode && <em>{errors.groupCode.message}</em>}</label>
          <label>Klasa (opcjonalnie)<input {...register("classLabel")} placeholder="np. kl. 7" /></label>
          <label>
            Liczba wychowawców
            <select {...register("educatorCount", { valueAsNumber: true })}>
              <option value={3}>3 osoby</option><option value={4}>4 osoby</option>
            </select>
          </label>
          <label id="data-poczatku-cyklu">Początek cyklu (poniedziałek)<input type="date" {...register("cycleStartDate")} />{errors.cycleStartDate && <em>{errors.cycleStartDate.message}</em>}</label>
          <label>Strefa czasu IANA<input {...register("timeZoneId")} /></label>
          <label>
            Horyzont planowania
            <select {...register("planningHorizonWeeks", { valueAsNumber: true })}>
              {[1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>{value} tyg.</option>)}
            </select>
          </label>
          <label>
            Granice harmonogramu
            <select {...register("scheduleBoundaryMode")}>
              <option value="FINITE">Skończony horyzont</option>
              <option value="CYCLIC" disabled={selectedHorizon !== 6}>Cykl powtarzalny (tylko 6 tygodni)</option>
            </select>
            {errors.scheduleBoundaryMode && <em>{errors.scheduleBoundaryMode.message}</em>}
          </label>
          <label>
            Początkowa pozycja weekendu
            <select {...register("startingWeekendVariant", { valueAsNumber: true })}>
              {[1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>Pozycja {value}</option>)}
            </select>
          </label>
          <p>Tryb pracy zmienisz w zakładce Reguły → Tryb pracy i narzędzia demonstracyjne.</p>
        </div>
        <section className="group-selection" aria-label="Zakres generowania grup">
          <strong>Grupy generowane wspólnie</strong>
          {configuration.groups.filter((item) => item.active).map((group) => (
            <label key={group.id}>
              <input
                type="checkbox"
                checked={configuration.selectedGroupIds.includes(group.id)}
                disabled={busy}
                onChange={(event) => toggleSelected(group.id, event.target.checked)}
              />
              {group.code} · {group.name}
            </label>
          ))}
        </section>
        <div className="profile-summary">
          {configuration.initialTemplateNeedsReview && <div id="potwierdzenie-danych"><p>Projekt startowy zawiera przykładowe osoby i godziny. Nie wysyłaj go jako rzeczywistego planu, dopóki nie sprawdzisz i nie dostosujesz wszystkich danych.</p><button type="button" className="button button--secondary" onClick={()=>{
            if(window.confirm("Czy sprawdziłeś nazwiska, godziny, plan pobytu i weekendy oraz zastąpiłeś przykład danymi swojej placówki?")) setConfiguration({...configuration,initialTemplateNeedsReview:false});
          }}>Potwierdzam przygotowanie własnych danych</button></div>}
          <div><small>Profil prawny</small><strong>{configuration.legalRules.sourceTitle}</strong></div>
          <StatusBadge value={configuration.legalRules.verificationStatus} />
        </div>
        <div className="form-footer">
          {isSubmitSuccessful && <span role="status">Zapisano lokalnie.</span>}
          <button className="button button--primary" type="submit">Zapisz konfigurację</button>
        </div>
      </form>
      <section className="section-block" aria-label="Dodawanie grup">
        <h2>Dodaj kolejną grupę</h2>
        <p>Wybierz konkretną grupę, np. VI lub VII. Dostanie puste formularze — bez kopiowania wychowawców, godzin, nocek, weekendów lub zatwierdzeń innej grupy. Reguły ogólne i daty cyklu są wspólne dla projektu.</p>
        <label>Oznaczenie nowej grupy<select value={newCode} disabled={busy} onChange={e => setNewCode(e.target.value)}>
          <option value="">Wybierz grupę</option>
          {GROUP_CODES.filter(code => !configuration.groups.some(g => g.code.trim().toUpperCase() === code)).map(code => <option key={code} value={code}>{code}</option>)}
        </select></label>
        <button type="button" className="button button--secondary" disabled={busy || !newCode || configuration.groups.length >= 8} onClick={addGroup}>Dodaj pustą grupę</button>
        {groupMessage && <p role="status">{groupMessage}</p>}
        <GroupImport hasUnsavedChanges={form.formState.isDirty}/>
      </section>
    </SectionTiles>
  );
}
