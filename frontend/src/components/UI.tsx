import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { getRuleGuidance } from "../help";
import type {
  CareInterval,
  DomainMessage,
  ScheduleConfiguration,
} from "../types";
import { formatHoursFromMinutes } from "../time";

export const DAY_NAMES = [
  "Poniedziałek",
  "Wtorek",
  "Środa",
  "Czwartek",
  "Piątek",
  "Sobota",
  "Niedziela",
];

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  title = "Brak konfiguracji",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="empty-state">
      <span aria-hidden="true">◇</span>
      <h2>{title}</h2>
      <p>{children}</p>
    </section>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase().replaceAll("_", "-");
  const labels: Record<string, string> = {
    ERROR: "BŁĄD",
    WARNING: "OSTRZEŻENIE",
    INFO: "INFORMACJA",
    INVALID_INPUT: "DANE DO POPRAWY",
    VALID_INPUT: "DANE POPRAWNE",
    COMPLETE: "KOMPLET",
    PRIMARY: "PODSTAWOWY",
    SUPPORT: "UZUPEŁNIAJĄCY",
  };
  return (
    <span className={`status status--${normalized}`}>
      {labels[value] ?? value.replaceAll("_", " ")}
    </span>
  );
}

export function minutesToTime(value: number) {
  if (value === 1440) return "24:00";
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function formatMinutes(value: number) {
  return `${formatHoursFromMinutes(value)} godz.`;
}

function messageValue(
  value: string | number | null | undefined,
  ruleId: string,
) {
  if (value === null || value === undefined) return "—";
  const durationRule =
    typeof value === "number" &&
    ["HOURS", "REST", "SEGMENT", "TIME-STEP", "LEGAL", "CROSS-WEEK"].some((part) =>
      ruleId.includes(part),
    );
  return durationRule ? formatMinutes(value) : value;
}

export function Timeline({ intervals }: { intervals: CareInterval[] }) {
  return (
    <div className="timeline" aria-label="Wymagane przedziały opieki">
      {intervals.map((interval) => (
        <span
          key={`${interval.startMinute}-${interval.endMinute}`}
          style={{
            left: `${(interval.startMinute / 1440) * 100}%`,
            width: `${((interval.endMinute - interval.startMinute) / 1440) * 100}%`,
          }}
          title={`${minutesToTime(interval.startMinute)}–${minutesToTime(interval.endMinute)}`}
        />
      ))}
      <i style={{ left: "25%" }}>06</i>
      <i style={{ left: "50%" }}>12</i>
      <i style={{ left: "75%" }}>18</i>
    </div>
  );
}

function messageContext(
  message: DomainMessage,
  configuration?: ScheduleConfiguration,
) {
  const group = configuration?.groups.find((item) => item.id === message.groupId);
  const educator = configuration?.educators.find(
    (item) => item.id === message.educatorId,
  );
  return [
    group ? `Grupa ${group.code} · ${group.name}` : null,
    educator ? `Osoba: ${educator.displayName}` : null,
    message.date ? `Data: ${message.date}` : null,
    message.startTime ? `Od: ${message.startTime}` : null,
  ].filter((item): item is string => Boolean(item));
}

export function MessagesTable({
  messages,
  configuration,
}: {
  messages: DomainMessage[];
  configuration?: ScheduleConfiguration;
}) {
  if (!messages.length) {
    return (
      <div className="success-note" role="status">
        <span aria-hidden="true">✓</span>
        Nie wykryto błędów ani ostrzeżeń. Możesz przejść do generowania.
      </div>
    );
  }

  const ordered = [...messages].sort((left, right) => {
    const rank = { ERROR: 0, WARNING: 1, INFO: 2 };
    return rank[left.severity] - rank[right.severity];
  });

  return (
    <div className="message-list">
      {ordered.map((message, index) => {
        const guidance = getRuleGuidance(message);
        const context = messageContext(message, configuration);
        const hasValues =
          message.requiredValue !== null &&
          message.requiredValue !== undefined ||
          message.actualValue !== null &&
          message.actualValue !== undefined;

        return (
          <article
            className={`message-card message-card--${message.severity.toLowerCase()}`}
            key={`${message.ruleId}-${index}`}
          >
            <div className="message-card__body">
              <div className="message-card__heading">
                <StatusBadge value={message.severity} />
                <div>
                  <h3>{guidance.title}</h3>
                  <p>{guidance.explanation}</p>
                </div>
              </div>
              {context.length > 0 && (
                <div className="message-card__context">
                  {context.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              )}
              <details className="message-details">
                <summary>Szczegóły techniczne</summary>
                <p>{message.message}</p>
                <code>{message.ruleId}</code>
                {hasValues && (
                  <p>
                    Wymagane: {messageValue(message.requiredValue, message.ruleId)}
                    {" · "}
                    Faktyczne: {messageValue(message.actualValue, message.ruleId)}
                  </p>
                )}
              </details>
            </div>
            <Link className="button button--secondary" to={guidance.actionTo}>
              {guidance.actionLabel}
            </Link>
          </article>
        );
      })}
    </div>
  );
}

export function DemoNotice({ children }: { children?: ReactNode }) {
  return (
    <aside className="demo-notice">
      <span aria-hidden="true">!</span>
      <div>
        <strong>Wyłącznie tryb demonstracyjny</strong>
        <p>
          {children ??
            "Profil prawny nie został zweryfikowany. Wyniku nie wolno używać do rzeczywistego planowania pracy."}
        </p>
      </div>
    </aside>
  );
}
