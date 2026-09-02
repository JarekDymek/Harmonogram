import { useState } from "react";
import { useAppState } from "../state/AppState";
import { WEEKDAY_NAMES } from "../nightDuties";
import type { RecurringWork } from "../types";
import { MessagesTable } from "./UI";

function CommitmentForm({ school }: { school: boolean }) {
  const { configuration, setConfiguration, inputReport } = useAppState();
  const [form, setForm] = useState({ educatorId: "", dayOfWeek: 2, startTime: "", endTime: "" });
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  if (!configuration) return null;
  const key = school ? "recurringSchoolWork" : "recurringRequiredDuties";
  const items = configuration[key] ?? [];
  const groupId = configuration.activeGroupId;
  const people = configuration.educators.filter(e => e.active && (school || configuration.groupMemberships.some(m => m.active && m.groupId === groupId && m.educatorId === e.id)));
  const title = school ? "Praca w szkole" : "Obowiązkowy dyżur w internacie";
  const messages = (inputReport?.messages ?? []).filter(m => school
    ? ["REQ-WORK-CALENDAR-001", "REQ-DAYS-001"].includes(m.ruleId)
    : m.ruleId === "REQ-REQUIRED-DUTY-001");
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const problem = !form.educatorId || !form.startTime || !form.endTime ? "Wybierz osobę i wpisz obie godziny."
      : form.startTime >= form.endTime ? "Godzina końca musi być późniejsza. Nocki wpisuj w sekcji Nocki."
      : items.some(i => i.id !== editingId && i.educatorId === form.educatorId && i.dayOfWeek === form.dayOfWeek && i.startTime < form.endTime && form.startTime < i.endTime)
        ? "Ta osoba ma już tutaj wpis w tych godzinach. Popraw istniejący wpis lub wybierz inne godziny." : "";
    setError(problem);
    if (problem) return;
    const item: RecurringWork = { ...form, id: editingId ?? crypto.randomUUID(), groupId: groupId!, description: title };
    setConfiguration({ ...configuration, [key]: editingId ? items.map(i => i.id === editingId ? item : i) : [...items, item] });
    setEditingId(null);
    setForm({ ...form, startTime: "", endTime: "" });
  };
  return <section className="section-block" id={school ? "szkola" : "stale-dyzury"}>
    <div className="section-heading"><div><span className="eyebrow">CO TYDZIEŃ · DO ODWOŁANIA</span><h2>{title}</h2></div></div>
    <p className="section-copy">{school
      ? "Wpisz rzeczywiste godziny lekcji/pracy, nie liczbę godzin lekcyjnych. To dzień pracy, nie wolne. Szkoła nie zwiększa wymiaru internatu. Generator preferuje internat w już zajęte dni, o ile pozwalają odpoczynki i potrzeby grupy."
      : "Odwrotność niedostępności: w tych godzinach ta osoba musi być na grupie. Dyżur wykorzystuje jej wpisany wymiar, nie dodaje nadgodzin. Dla osoby oznaczonej wyżej jako „Stały plan pomocniczy” wpisz tutaj cały jej tygodniowy wymiar — generator nie dopisze jej innych godzin i powtórzy ten układ przez wszystkie tygodnie."}</p>
    <form className="inline-form" onSubmit={submit}>
      <label>Wychowawca<select aria-label={`${title}: wychowawca`} required value={form.educatorId} onChange={e => setForm({ ...form, educatorId: e.target.value })}><option value="">Wybierz</option>{people.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}</select></label>
      <label>Dzień<select aria-label={`${title}: dzień`} value={form.dayOfWeek} onChange={e => setForm({ ...form, dayOfWeek: Number(e.target.value) })}>{WEEKDAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>
      <label>Od<input aria-label={`${title}: od`} type="time" required step={school ? 60 : 1800} value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} /></label>
      <label>Do<input aria-label={`${title}: do`} type="time" required step={school ? 60 : 1800} value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} aria-invalid={Boolean(error)} /></label>
      <button className="button button--primary" type="submit">{editingId ? "Zapisz poprawione godziny" : "Dodaj na każdy tydzień"}</button>
      {editingId && <button className="button button--ghost" type="button" onClick={() => { setEditingId(null); setError(""); }}>Anuluj edycję</button>}
    </form>
    {error && <p className="form-message" role="alert">{error}</p>}
    <div className="record-list">{items.filter(i => school || i.groupId === groupId).map(item => <div className={`record-row ${messages.some(m => m.educatorId === item.educatorId && (!m.date || (new Date(`${m.date}T12:00:00Z`).getUTCDay() + 6) % 7 === item.dayOfWeek || school)) ? "record-row--error" : ""}`} key={item.id}>
      <strong>{configuration.educators.find(e => e.id === item.educatorId)?.displayName} · {WEEKDAY_NAMES[item.dayOfWeek]} {item.startTime}–{item.endTime}</strong>
      <span>co tydzień</span>
      <button className="button button--ghost" type="button" onClick={() => {
        setForm({ educatorId: item.educatorId, dayOfWeek: item.dayOfWeek, startTime: item.startTime, endTime: item.endTime });
        setEditingId(item.id); setError("");
      }}>Popraw godziny</button>
      <button className="icon-button" type="button" aria-label={`Usuń ${title} ${WEEKDAY_NAMES[item.dayOfWeek]} ${item.startTime}`} onClick={() => setConfiguration({ ...configuration, [key]: items.filter(i => i.id !== item.id) })}>×</button>
    </div>)}</div>
    {messages.length > 0 && <MessagesTable messages={messages} configuration={configuration} />}
  </section>;
}

export function WorkCommitments() { return <><CommitmentForm school={false} /><CommitmentForm school /></>; }
