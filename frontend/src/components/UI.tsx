import type { ReactNode } from "react";
import type { CareInterval, DomainMessage } from "../types";

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
  return <span className={`status status--${normalized}`}>{value.replaceAll("_", " ")}</span>;
}

export function minutesToTime(value: number) {
  if (value === 1440) return "24:00";
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours} godz. ${minutes ? `${minutes} min` : ""}`.trim();
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

export function MessagesTable({ messages }: { messages: DomainMessage[] }) {
  if (!messages.length) {
    return (
      <div className="success-note" role="status">
        <span aria-hidden="true">✓</span>
        Nie wykryto naruszeń ani ostrzeżeń.
      </div>
    );
  }
  return (
    <div className="table-scroll">
      <table className="data-table message-table">
        <thead>
          <tr>
            <th>Poziom</th>
            <th>Reguła</th>
            <th>Opis</th>
            <th>Kontekst</th>
            <th>Wymagane / faktyczne</th>
          </tr>
        </thead>
        <tbody>
          {messages.map((message, index) => (
            <tr key={`${message.ruleId}-${index}`}>
              <td>
                <StatusBadge value={message.severity} />
              </td>
              <td>
                <code>{message.ruleId}</code>
              </td>
              <td>{message.message}</td>
              <td>
                {[message.date, message.educatorId, message.startTime]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </td>
              <td>
                {message.requiredValue ?? "—"} / {message.actualValue ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
