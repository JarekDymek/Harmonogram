import type {ScheduleConfiguration} from "./types";
export interface SetupStep {key:string;title:string;ready:boolean;detail:string;to:string}
export const generationMissing=(c:ScheduleConfiguration)=>c.requestedOperationMode==="PRODUCTION"?setupSteps(c).filter(s=>!s.ready):[];
export function setupSteps(c:ScheduleConfiguration):SetupStep[] {
 const groups=c.groups.filter(g=>g.active&&c.selectedGroupIds.includes(g.id));
 const steps:SetupStep[]=[{key:"scope",title:"Grupy do generowania",ready:groups.length>0,detail:groups.length?`Wybrano ${groups.map(g=>g.code).join(", ")}.`:"Dołącz co najmniej jedną grupę.",to:"/konfiguracja"}];
 if(c.initialTemplateNeedsReview) steps.push({key:"template",title:"Zastąp lub potwierdź dane startowe",ready:false,detail:"Nowy projekt zawiera przykład struktury. Sprawdź nazwiska, godziny, plan pobytu i weekendy. Potwierdź przygotowanie własnych danych w Konfiguracji.",to:"/konfiguracja#potwierdzenie-danych"});
 for(const g of groups) {
  const members=c.groupMemberships.filter(m=>m.active&&m.groupId===g.id);
  const staff=members.length>=3&&members.length<=4&&members.every(m=>c.educators.some(e=>e.id===m.educatorId&&e.active&&e.displayName.trim())&&m.weeklyTargetHoursByWeek.length>0&&m.weeklyTargetHoursByWeek.every(h=>Number.isFinite(h)&&h>=0));
  const plans=c.dayPlans.filter(p=>p.groupId===g.id);
  const weekends=c.weekendVariants.filter(v=>v.groupId===g.id&&v.variantKind==="BASE"&&v.approved);
  const suffix=`?grupa=${encodeURIComponent(g.id)}`;
  steps.push({key:`staff-${g.id}`,title:`${g.code}: wychowawcy i wymiary`,ready:staff,detail:staff?"Wpisano osoby i wymiary. Nocki, szkołę i obowiązkowe dyżury sprawdź w kalendarzu pracy.":"Wpisz 3–4 aktywne osoby, nazwiska i wymiary godzin.",to:`/wychowawcy${suffix}`});
  steps.push({key:`stay-${g.id}`,title:`${g.code}: plan pobytu`,ready:plans.length>0&&plans.every(p=>p.approved),detail:plans.length?"Plan wpisany; pełne pokrycie dat i godzin sprawdzi walidacja.":"Wpisz godziny obecności grupy i wyjścia do szkoły.",to:`/plany${suffix}`});
  steps.push({key:`weekends-${g.id}`,title:`${g.code}: weekendy`,ready:[1,2,3,4,5,6].every(n=>weekends.filter(v=>v.positionInCycle===n).length===1),detail:"Uzupełnij i zapisz sześć pozycji weekendu. Wolne i preferencje są osobne dla każdej osoby.",to:`/weekendy${suffix}#wzorce-weekendowe`});
 }
 const l=c.legalRules, legal=c.requestedOperationMode==="DEMONSTRATION" || (l.verificationStatus==="VERIFIED"&&!!l.approvedBy?.trim()&&!!l.verifiedAt&&!!l.effectiveFrom&&!!l.sourceTitle?.trim()&&!!(l.sourceIdentifier||l.sourceSection));
 steps.push({key:"rules",title:"Reguły i zatwierdzenie",ready:legal,detail:legal?"Profil zapisany. Pełną ważność i zgodność danych sprawdzi backend.":"Uzupełnij osobę, źródło, datę i ważność profilu w Regułach.",to:"/reguly#reguly-organizacyjne"});
 return steps;
}
