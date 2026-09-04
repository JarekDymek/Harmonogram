import { useNavigate } from "react-router-dom";
import { useAppState } from "../state/AppState";
import { generatedGroups } from "../groupScope";
import { isValidatedPlan } from "../generation";
import { MessagesTable } from "./UI";
import { generationMissing } from "../readiness";

export function GroupScopePanel() {
  const {configuration: c, generation, generationAttempt, setSelectedGroups, generate, busy} = useAppState();
  const navigate = useNavigate();
  if (!c || c.groups.length < 2) return null;
  const completed = new Set(isValidatedPlan(generation) ? generatedGroups(generation) : []);
  const active = c.groups.find(g => g.id === c.activeGroupId)!;
  const included = c.selectedGroupIds.includes(active.id);
  const missing = generationMissing({...c,selectedGroupIds:[...new Set([...c.selectedGroupIds,active.id])]});
  const run = async () => {
    await generate({groupIds: [...new Set([...c.selectedGroupIds, active.id])]});
    navigate("/harmonogram");
  };
  return <section className="section-block" aria-label="Grupy dołączone do generowania">
    <h2>Grupy dołączone do generowania</h2>
    <p>Zaznaczone grupy generują się razem. Pozostałe są w zawieszeniu — ich dane zostają zapisane.</p>
    <div className="button-row" style={{flexWrap: "wrap"}}>
      {c.groups.filter(g => g.active).sort((a,b) => a.displayOrder-b.displayOrder).map(g =>
        <label key={g.id} style={{padding: "8px"}}>
          <input type="checkbox" aria-label={`Dołącz grupę ${g.code}`} disabled={busy}
            checked={c.selectedGroupIds.includes(g.id)}
            onChange={e => setSelectedGroups(e.target.checked ? [...c.selectedGroupIds,g.id] : c.selectedGroupIds.filter(id => id !== g.id))}/>
          {" "}{g.code} · {completed.has(g.id) ? "zapisany plan" : "bez planu"}
        </label>)}
    </div>
    <p>Oglądasz grupę {active.code}. {included ? "Jest dołączona do najbliższych obliczeń." : "Jest poza zakresem obliczeń."}
      {" "}Zapisany wynik obejmuje: {[...completed].map(id => c.groups.find(g => g.id === id)?.code).join(", ") || "brak"}.</p>
    <button type="button" className="button button--primary" disabled={busy || missing.length>0} onClick={() => void run()}>
      {busy ? "Generowanie…" : included ? "Wygeneruj dołączone grupy" : "Dołącz tę grupę i wygeneruj"}
    </button>
    {missing.length>0 && <p role="status">Przed dołączeniem: {missing.map(s=>s.title).join("; ")}. <button type="button" className="button button--text" onClick={()=>navigate(missing[0].to)}>Uzupełnij pierwszą brakującą sekcję</button></p>}
    {generationAttempt && !isValidatedPlan(generationAttempt) && <>
      <p role="status">Ostatnia próba nie utworzyła nowego planu. Zachowane wcześniejsze grupy nie oznaczają powodzenia tej próby.</p>
      <MessagesTable messages={generationAttempt.messages} configuration={c}/>
    </>}
  </section>;
}
