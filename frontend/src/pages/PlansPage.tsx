import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  DAY_NAMES,
  EmptyState,
  PageHeader,
  Timeline,
  formatMinutes,
} from "../components/UI";
import { useAppState } from "../state/AppState";
import type { CareInterval, DayPlan } from "../types";

function toMinute(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function preview(plan: DayPlan): CareInterval[] {
  const operating = plan.operatingIntervals[0];
  if (!operating) return [];
  const start = toMinute(operating.startTime);
  const end = toMinute(operating.endTime);
  const noCare = plan.noCareIntervals[0];
  if (!noCare) return [{ startMinute: start, endMinute: end, requiredStaffCount: 1 }];
  const cutStart = toMinute(noCare.startTime);
  const cutEnd = toMinute(noCare.endTime);
  return [
    ...(start < cutStart
      ? [{ startMinute: start, endMinute: cutStart, requiredStaffCount: 1 }]
      : []),
    ...(cutEnd < end
      ? [{ startMinute: cutEnd, endMinute: end, requiredStaffCount: 1 }]
      : []),
  ];
}

export function PlansPage() {
  const { configuration, setConfiguration } = useAppState();
  const [plans, setPlans] = useState<DayPlan[]>([]);
  const exceptionForm = useForm<{
    scope: "CYCLE_WEEK" | "SPECIFIC_DATE";
    weekNumber: number;
    dayOfWeek: number;
    date: string;
    operatingStart: string;
    operatingEnd: string;
    noCareStart: string;
    noCareEnd: string;
    eventType: string;
    description: string;
  }>();

  useEffect(() => {
    if (configuration) {
      setPlans(structuredClone(configuration.dayPlans));
      exceptionForm.reset({
        scope: "SPECIFIC_DATE",
        weekNumber: 1,
        dayOfWeek: 0,
        date: configuration.cycleStartDate,
        operatingStart: "06:00",
        operatingEnd: "22:00",
        noCareStart: "08:00",
        noCareEnd: "14:00",
        eventType: "SCHOOL",
        description: "",
      });
    }
  }, [configuration, exceptionForm]);

  const basePlans = useMemo(
    () =>
      plans
        .filter((item) => item.scope === "BASE_WEEKLY")
        .sort((a, b) => (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0)),
    [plans],
  );
  const exceptions = useMemo(
    () => plans.filter((item) => item.scope !== "BASE_WEEKLY"),
    [plans],
  );

  if (!configuration) return <EmptyState>Najpierw utwórz konfigurację.</EmptyState>;

  const updatePlan = (
    id: string,
    section: "operatingIntervals" | "noCareIntervals",
    boundary: "startTime" | "endTime",
    value: string,
  ) => {
    setPlans((current) =>
      current.map((plan) => {
        if (plan.id !== id) return plan;
        const intervals = [...plan[section]];
        if (!intervals[0]) {
          intervals.push({
            id: crypto.randomUUID(),
            startTime: boundary === "startTime" ? value : "08:00",
            endTime: boundary === "endTime" ? value : "14:00",
            eventType: section === "noCareIntervals" ? "SCHOOL" : null,
            customEventType: null,
            description: "",
          });
        } else {
          intervals[0] = { ...intervals[0], [boundary]: value };
        }
        return { ...plan, [section]: intervals };
      }),
    );
  };

  const save = () => {
    setConfiguration({ ...configuration, dayPlans: plans });
  };

  const addException = exceptionForm.handleSubmit((values) => {
    const approvedAt = new Date().toISOString();
    const item: DayPlan = {
      id: crypto.randomUUID(),
      configurationVersionId: configuration.configurationVersionId,
      groupId: configuration.groupId,
      scope: values.scope,
      weekNumber:
        values.scope === "CYCLE_WEEK" ? Number(values.weekNumber) : null,
      dayOfWeek:
        values.scope === "CYCLE_WEEK" ? Number(values.dayOfWeek) : null,
      date: values.scope === "SPECIFIC_DATE" ? values.date : null,
      operatingIntervals: [
        {
          id: crypto.randomUUID(),
          startTime: values.operatingStart,
          endTime: values.operatingEnd,
          description: "",
          eventType: null,
        },
      ],
      noCareIntervals:
        values.noCareStart && values.noCareEnd
          ? [
              {
                id: crypto.randomUUID(),
                startTime: values.noCareStart,
                endTime: values.noCareEnd,
                eventType: values.eventType,
                description: values.description,
              },
            ]
          : [],
      eventType: values.eventType,
      description: values.description,
      approved: true,
      approvedAt,
      approvedBy: "UŻYTKOWNIK",
    };
    const keyMatches = (existing: DayPlan) =>
      existing.scope === item.scope &&
      (item.scope === "SPECIFIC_DATE"
        ? existing.date === item.date
        : existing.weekNumber === item.weekNumber &&
          existing.dayOfWeek === item.dayOfWeek);
    const next = [...plans.filter((value) => !keyMatches(value)), item];
    setPlans(next);
    setConfiguration({ ...configuration, dayPlans: next });
  });

  return (
    <>
      <PageHeader
        eyebrow="KROK 04 · ZAPOTRZEBOWANIE"
        title="Plan pobytu wychowanków"
        description="Zapotrzebowanie jest różnicą godzin działania i znormalizowanych okresów bez opieki. Podgląd nie zastępuje obliczenia backendu."
        actions={
          <button className="button button--primary" type="button" onClick={save}>
            Zapisz wszystkie plany
          </button>
        }
      />
      <section className="plan-list">
        {basePlans.map((plan) => {
          const intervals = preview(plan);
          const total = intervals.reduce(
            (sum, item) => sum + item.endMinute - item.startMinute,
            0,
          );
          return (
            <article className="plan-row" key={plan.id}>
              <div className="plan-row__day">
                <span>{String((plan.dayOfWeek ?? 0) + 1).padStart(2, "0")}</span>
                <strong>{DAY_NAMES[plan.dayOfWeek ?? 0]}</strong>
                <small>{formatMinutes(total)} opieki</small>
              </div>
              <div className="plan-row__editor">
                <div className="time-fields">
                  <label>
                    Działanie od
                    <input
                      type="time"
                      step="1800"
                      value={plan.operatingIntervals[0]?.startTime ?? ""}
                      onChange={(event) =>
                        updatePlan(
                          plan.id,
                          "operatingIntervals",
                          "startTime",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label>
                    do
                    <input
                      type="time"
                      step="1800"
                      value={plan.operatingIntervals[0]?.endTime ?? ""}
                      onChange={(event) =>
                        updatePlan(
                          plan.id,
                          "operatingIntervals",
                          "endTime",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label>
                    Bez opieki od
                    <input
                      type="time"
                      step="1800"
                      value={plan.noCareIntervals[0]?.startTime ?? ""}
                      onChange={(event) =>
                        updatePlan(
                          plan.id,
                          "noCareIntervals",
                          "startTime",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label>
                    do
                    <input
                      type="time"
                      step="1800"
                      value={plan.noCareIntervals[0]?.endTime ?? ""}
                      onChange={(event) =>
                        updatePlan(
                          plan.id,
                          "noCareIntervals",
                          "endTime",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                </div>
                <Timeline intervals={intervals} />
              </div>
            </article>
          );
        })}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">PEŁNE ZASTĄPIENIE</span>
            <h2>Plan tygodnia albo konkretnej daty</h2>
          </div>
        </div>
        <form className="inline-form" onSubmit={addException}>
          <label>
            Zakres
            <select {...exceptionForm.register("scope")}>
              <option value="SPECIFIC_DATE">Konkretna data</option>
              <option value="CYCLE_WEEK">Tydzień cyklu</option>
            </select>
          </label>
          <label>
            Tydzień
            <input
              type="number"
              min="1"
              max="6"
              {...exceptionForm.register("weekNumber", { valueAsNumber: true })}
            />
          </label>
          <label>
            Dzień 0–6
            <input
              type="number"
              min="0"
              max="6"
              {...exceptionForm.register("dayOfWeek", { valueAsNumber: true })}
            />
          </label>
          <label>
            Data
            <input type="date" {...exceptionForm.register("date")} />
          </label>
          <label>
            Działanie od
            <input type="time" step="1800" {...exceptionForm.register("operatingStart")} />
          </label>
          <label>
            Działanie do
            <input type="time" step="1800" {...exceptionForm.register("operatingEnd")} />
          </label>
          <label>
            Bez opieki od
            <input type="time" step="1800" {...exceptionForm.register("noCareStart")} />
          </label>
          <label>
            Bez opieki do
            <input type="time" step="1800" {...exceptionForm.register("noCareEnd")} />
          </label>
          <label>
            Rodzaj
            <select {...exceptionForm.register("eventType")}>
              <option value="SCHOOL">Szkoła</option>
              <option value="INTERNSHIP">Praktyki</option>
              <option value="TRIP">Wycieczka</option>
              <option value="ACTIVITY_OUTSIDE">Zajęcia poza internatem</option>
              <option value="OTHER_CARE">Inna opieka</option>
            </select>
          </label>
          <label className="inline-form__wide">
            Opis
            <input {...exceptionForm.register("description")} />
          </label>
          <button className="button button--secondary" type="submit">
            Dodaj zatwierdzony plan
          </button>
        </form>
        <div className="record-list">
          {exceptions.map((item) => (
            <div className="record-row" key={item.id}>
              <div>
                <strong>
                  {item.scope === "SPECIFIC_DATE"
                    ? item.date
                    : `Tydzień ${item.weekNumber}, ${DAY_NAMES[item.dayOfWeek ?? 0]}`}
                </strong>
                <small>{item.description || "Bez opisu"}</small>
              </div>
              <span>
                {item.operatingIntervals[0]?.startTime}–
                {item.operatingIntervals[0]?.endTime}
              </span>
              <button
                className="icon-button"
                type="button"
                aria-label={`Usuń plan ${item.id}`}
                onClick={() => {
                  const next = plans.filter((value) => value.id !== item.id);
                  setPlans(next);
                  setConfiguration({ ...configuration, dayPlans: next });
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
