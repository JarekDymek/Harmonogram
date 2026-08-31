import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getRepairOptions, getRuleGuidance } from "../help";
import type { DomainMessage, ScheduleConfiguration } from "../types";

function messageKey(message: DomainMessage) {
  return JSON.stringify([
    message.ruleId,
    message.groupId,
    message.educatorId,
    message.date,
    message.context,
  ]);
}

export function RepairGuide({
  messages,
  configuration,
  busy = false,
  onRecheck,
  recheckTo,
}: {
  messages: DomainMessage[];
  configuration?: ScheduleConfiguration;
  busy?: boolean;
  onRecheck?: () => void;
  recheckTo?: string;
}) {
  const actionable = useMemo(() => {
    const errors = messages.filter((message) => message.severity === "ERROR");
    return errors.length > 0 ? errors : messages;
  }, [messages]);
  const issueFingerprint = actionable.map(messageKey).join("|");
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    setStepIndex(0);
  }, [issueFingerprint]);

  if (actionable.length === 0) return null;

  const safeStepIndex = Math.min(stepIndex, actionable.length - 1);
  const message = actionable[safeStepIndex];
  const guidance = getRuleGuidance(message, configuration);
  const options = getRepairOptions(message, configuration);
  const stepNumber = safeStepIndex + 1;

  return (
    <section
      className="repair-guide repair-guide--error"
      aria-labelledby="repair-guide-title"
    >
      <header className="repair-guide__header">
        <div>
          <span className="eyebrow">PLAN NAPRAWY KROK PO KROKU</span>
          <p className="repair-guide__progress-label">
            Krok {stepNumber} z {actionable.length}
          </p>
        </div>
        <progress
          aria-label={`Postęp naprawy: krok ${stepNumber} z ${actionable.length}`}
          max={actionable.length}
          value={stepNumber}
        />
      </header>

      <div className="repair-guide__problem">
        <h2 id="repair-guide-title">{guidance.title}</h2>
        <p>{guidance.explanation}</p>
      </div>

      <div className="repair-guide__options" aria-label="Proponowane sposoby naprawy">
        {options.map((option, optionIndex) => (
          <article className="repair-option" key={`${option.actionTo}-${optionIndex}`}>
            <div>
              <span className="repair-option__number">Opcja {optionIndex + 1}</span>
              <h3>{option.label}</h3>
              <p>{option.description}</p>
              <p className="repair-option__destination">
                <strong>Miejsce:</strong> {option.destination}
              </p>
            </div>
            <Link
              className={`button ${optionIndex === 0 ? "button--primary" : "button--secondary"}`}
              to={option.actionTo}
            >
              {option.label}
            </Link>
          </article>
        ))}
      </div>

      <p className="repair-guide__safety-note">
        Aplikacja niczego nie poprawia automatycznie. Po zapisaniu zmiany sprawdź
        dane ponownie — naprawiony problem zniknie, a przewodnik pokaże kolejny.
      </p>

      <div className="repair-guide__footer">
        <div className="repair-guide__navigation" aria-label="Nawigacja po problemach">
          <button
            className="button button--ghost"
            type="button"
            disabled={safeStepIndex === 0}
            onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
          >
            Poprzedni problem
          </button>
          <button
            className="button button--ghost"
            type="button"
            disabled={safeStepIndex === actionable.length - 1}
            onClick={() =>
              setStepIndex((current) => Math.min(actionable.length - 1, current + 1))
            }
          >
            Następny problem
          </button>
        </div>
        {onRecheck && (
          <button
            className="button button--secondary"
            type="button"
            disabled={busy}
            onClick={onRecheck}
          >
            {busy ? "Sprawdzanie…" : "Sprawdź ponownie po poprawce"}
          </button>
        )}
        {!onRecheck && recheckTo && (
          <Link className="button button--secondary" to={recheckTo}>
            Wróć do sprawdzenia danych
          </Link>
        )}
      </div>

      <details className="message-details repair-guide__details">
        <summary>Dlaczego aplikacja zgłasza ten problem?</summary>
        <p>{message.message}</p>
        <code>{message.ruleId}</code>
      </details>
    </section>
  );
}
