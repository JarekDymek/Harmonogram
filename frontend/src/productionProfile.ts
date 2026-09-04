import type {ScheduleConfiguration} from "./types";
export function verificationLocalInput(value:string|null|undefined):string {
 if(!value) return "";
 const d=new Date(value);if(!Number.isFinite(d.getTime())) return "";
 return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
export function productionProfile(c:ScheduleConfiguration, now=new Date()):ScheduleConfiguration {
 const date=new Intl.DateTimeFormat("en-CA",{timeZone:c.timeZoneId,year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
 const end=new Date(`${date}T12:00:00Z`); end.setUTCFullYear(end.getUTCFullYear()+1);
 return {...c,requestedOperationMode:"PRODUCTION",demonstrationNotice:"",legalRules:{...c.legalRules,
  verificationStatus:"VERIFIED",approvedBy:"Jarosław Dymek",verifiedAt:now.toISOString(),effectiveFrom:date,effectiveTo:end.toISOString().slice(0,10),
  jurisdiction:"PL — profil organizacyjny placówki",sourceTitle:"Ustawienia placówki zatwierdzone przez użytkownika",
  sourceIdentifier:"https://www.pip.gov.pl/dla-pracownikow/porady-prawne/czas-pracy",sourceSection:"Kodeks pracy art. 132–133; przy zatrudnieniu nauczycielskim również Karta Nauczyciela art. 42 i 42c — sprawdź zastosowanie do placówki",
  version:`USER-${date}`,verificationNotes:"Zatwierdzenie ustawień przez użytkownika na jego polecenie. Nie jest niezależną opinią prawną ani potwierdzeniem wszystkich wyjątków. Parametry, źródła i daty można zmienić; data nie odnawia się przy uruchomieniu.",
 }};
}
