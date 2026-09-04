import type { DomainMessage, Educator, WeekendDaysOffPattern } from "../types";
import { WEEKDAY_NAMES } from "../nightDuties";
import "./WeekendDaysOffEditor.css";

export function validDaysOff(pattern: WeekendDaysOffPattern) {
  return !pattern.active || (pattern.mode && pattern.mode !== "FIXED") || (pattern.daysOff.length === 2 && new Set(pattern.daysOff).size === 2 &&
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
    <p className="muted">Możesz wskazać obowiązkową parę albo poprosić o dwa kolejne dni bez wybierania dat.
      Przy preferencji generator dobiera parę osobno na każdy tydzień. Jeśli jej nie znajdzie, zwróci poprawny plan
      z informacją o rozdzielonym wolnym. Nocka, szkoła i pozostałe obowiązki nie są pomijane.</p>
    <div className="record-list">{educators.map(educator => {
      const pattern = patterns.find(p => p.educatorId === educator.id);
      const errors = messages.filter(m => m.severity === "ERROR" && m.ruleId === "REQ-WEEKEND-DAYS-OFF-001" && m.educatorId === educator.id);
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
          <label>Sposób planowania wolnego
            <select aria-label={`${educator.displayName}: sposób planowania wolnego`}
              value={pattern?.mode ?? "FIXED"}
              onChange={e => onChange([...patterns.filter(p => p.educatorId !== educator.id), {
                ...(pattern ?? {id: crypto.randomUUID(), educatorId: educator.id, daysOff: [], active: true}),
                mode: e.target.value as WeekendDaysOffPattern["mode"],
              }])}>
              <option value="FIXED">Obowiązkowe wskazane dni</option>
              <option value="PREFER_CONSECUTIVE">Preferuj dwa kolejne dni — wybiera generator</option>
              <option value="PREFER_AFTER_FREE_WEEKEND">Preferuj poniedziałek i wtorek po wolnym weekendzie</option>
            </select>
          </label>
          {(!pattern?.mode || pattern.mode === "FIXED") && [0, 1].map(index => <label key={index}>
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
        {pattern?.mode && pattern.mode !== "FIXED" && <p>To preferencja: niespełnienie jej nie zablokuje planu.
          Dni, których dotyka nocka lub praca w szkole, nie mogą być wolne.</p>}
        {pattern?.mode === "PREFER_AFTER_FREE_WEEKEND" && <p>Przy pracującym weekendzie szukamy dwóch kolejnych wolnych dni od poniedziałku do piątku. Jeżeli poprzednia sobota i niedziela były wolne, preferujemy poniedziałek i wtorek. Dla pierwszego tygodnia w skończonym planie nie zakładamy, że wcześniejszy weekend był wolny. Obowiązkowe dyżury mają pierwszeństwo.</p>}
        {!pattern && <small>Brak stałego wzorca — generator wybierze dwa dni wolne.</small>}
      </article>;
    })}</div>
  </section>;
}
