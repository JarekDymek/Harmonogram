import type { DomainMessage, Educator, WeekendDaysOffPattern } from "../types";
import { WEEKDAY_NAMES } from "../nightDuties";
import "./WeekendDaysOffEditor.css";

export function validDaysOff(pattern: WeekendDaysOffPattern) {
  return !pattern.active || (pattern.daysOff.length === 2 && new Set(pattern.daysOff).size === 2 &&
    pattern.daysOff.every(d => Number.isInteger(d) && d >= 0 && d <= 6));
}

export function WeekendDaysOffEditor({ educators, patterns, messages, onChange }: {
  educators: Educator[];
  patterns: WeekendDaysOffPattern[];
  messages: DomainMessage[];
  onChange: (patterns: WeekendDaysOffPattern[]) => void;
}) {
  return <section className="section-block" id="wolne-za-weekend">
    <div className="section-heading"><div>
      <span className="eyebrow">STAŁE DNI WOLNE</span>
      <h2>Dwa dni wolne przy pracującym weekendzie</h2>
    </div></div>
    <p>Wybierz raz dla każdej osoby i kliknij „Zapisz wzorce”. Gdy ta osoba pracuje w sobotę lub niedzielę,
      wskazane dni w tym samym tygodniu (poniedziałek–niedziela) będą całkowicie wolne.
      Dotyczy to wszystkich grup, szkoły i obu dat nocki. W wolny weekend wzorzec się nie włącza.</p>
    <p className="muted">To obowiązkowe wolne, nie preferencja. Zapis nie przenosi ani nie usuwa istniejących dyżurów.
      Konflikt wskaże „Sprawdź dane” przed generowaniem.</p>
    <div className="record-list">{educators.map(educator => {
      const pattern = patterns.find(p => p.educatorId === educator.id);
      const errors = messages.filter(m => m.ruleId === "REQ-WEEKEND-DAYS-OFF-001" && m.educatorId === educator.id);
      const invalid = pattern && !validDaysOff(pattern);
      const update = (index: number, value: string) => {
        const next = pattern ? structuredClone(pattern) : {
          id: crypto.randomUUID(), educatorId: educator.id, daysOff: [-1, -1], active: true,
        };
        next.daysOff[index] = Number(value);
        onChange([...patterns.filter(p => p.educatorId !== educator.id), next]);
      };
      return <article className={`weekend-off-card${invalid || errors.length ? " weekend-off-card--error" : ""}`}
        key={educator.id} id={pattern ? `wolne-${pattern.id}` : `wolne-osoba-${educator.id}`}>
        <h3>{educator.displayName}</h3>
        <div className="inline-form">
          {[0, 1].map(index => <label key={index}>
            {index === 0 ? "Pierwszy dzień wolny" : "Drugi dzień wolny"}
            <select aria-label={`${educator.displayName}: ${index === 0 ? "pierwszy" : "drugi"} dzień wolny`}
              aria-invalid={Boolean(invalid || errors.length)} value={pattern?.daysOff[index] ?? -1}
              onChange={e => update(index, e.target.value)}>
              <option value={-1}>Wybierz dzień</option>
              {WEEKDAY_NAMES.map((name, day) => <option key={day} value={day}>{name}</option>)}
            </select>
          </label>)}
          {pattern && <>
            <label><input type="checkbox" checked={pattern.active} onChange={e => onChange(patterns.map(p =>
              p.id === pattern.id ? { ...p, active: e.target.checked } : p))} /> Stosuj wzorzec</label>
            <button className="button button--secondary" type="button" onClick={() =>
              onChange(patterns.filter(p => p.educatorId !== educator.id))}>Usuń wzorzec dla {educator.displayName}</button>
          </>}
        </div>
        {invalid && <p role="alert">Wybierz dwa różne dni. Oba pola muszą być uzupełnione.</p>}
        {errors.map((m, i) => <p role="alert" key={i}>{m.message}</p>)}
        {!pattern && <small>Brak stałego wzorca — generator wybierze dwa dni wolne.</small>}
      </article>;
    })}</div>
  </section>;
}
