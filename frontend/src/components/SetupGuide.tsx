import {Link} from "react-router-dom";
import {useAppState} from "../state/AppState";
import {setupSteps} from "../readiness";
export function SetupGuide(){
 const {configuration:c,inputReport}=useAppState();
 if(!c) return null;
 const steps=setupSteps(c),missing=steps.filter(s=>!s.ready);
 return <details className="section-tile setup-guide" open={missing.length>0}>
  <summary>Przygotowanie grup {c.groups.filter(g=>c.selectedGroupIds.includes(g.id)).map(g=>g.code).join(", ") || "— brak dołączonych"}: {steps.length-missing.length}/{steps.length} sekcji uzupełnionych</summary>
  <p>To kontrola kompletności, nie potwierdzenie wykonalności. Opcjonalnych nocek, szkoły ani niedostępności nie trzeba dopisywać, jeśli nie występują. Pozostałe grupy są pomijane.</p>
  <ol>{steps.map(s=><li key={s.key} className={s.ready?"setup-done":"setup-missing"}><strong>{s.ready?"✓":"○"} {s.title}</strong><p>{s.detail}</p><Link to={s.to}>{s.ready?"Sprawdź / zmień":"Uzupełnij teraz"}</Link></li>)}</ol>
  {missing.length>0?<p role="status">Najpierw: <Link to={missing[0].to}>{missing[0].title}</Link>. Przycisk generowania będzie dostępny po uzupełnieniu braków.</p>:<p>{inputReport?.status==="VALID_INPUT"?"Kontrola danych zaliczona.":"Dane podstawowe wpisane. Teraz uruchom sprawdzenie i generowanie; ewentualne konflikty pokażą się oddzielnie."}</p>}
 </details>;
}
