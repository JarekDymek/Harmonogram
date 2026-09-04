export const LEGAL_SOURCE="https://www.pip.gov.pl/dla-pracownikow/porady-prawne/czas-pracy";
export const RULE_HELP:Record<string,[string,string]>={
 verificationStatus:["Zatwierdzenie użytkownika","VERIFIED oznacza zapisane zatwierdzenie profilu przez wskazaną osobę, nie opinię prawną ani certyfikat aplikacji. Brak zatwierdzenia blokuje tryb rzeczywisty."],
 jurisdiction:["Zakres stosowania","Wpisz państwo i system zatrudnienia. Sama zmiana tekstu nie przełącza przepisów generatora."],
 version:["Wersja ustawień","Pozwala rozpoznać, według jakich ustaleń powstał plan. Zmieniaj po zmianie uzgodnień placówki."],
 sourceTitle:["Podstawa ustawień","Nazwij źródło: regulamin placówki i właściwe przepisy. Wpisanie tytułu nie potwierdza zgodności wartości z prawem."],
 sourceIdentifier:["Dokładne źródło","Podaj adres lub oznaczenie dokumentu, aby osoba sprawdzająca mogła odnaleźć podstawę reguł."],
 sourceSection:["Konkretny przepis","Wskaż artykuły lub punkty regulaminu. Dla nauczycieli sprawdź również Kartę Nauczyciela, w szczególności art. 42 i 42c."],
 approvedBy:["Osoba zatwierdzająca","Osoba odpowiedzialna za sprawdzenie ustawień. Możesz ją zmienić; generator nie weryfikuje jej uprawnień."],
 verifiedAt:["Data sprawdzenia","Kiedy osoba zatwierdzająca rzeczywiście sprawdziła profil. Data nie odnawia się przy każdym uruchomieniu."],
 effectiveFrom:["Początek ważności","Cały generowany okres musi przypadać w ważności profilu. Wcześniejszy plan wymaga odpowiednio wcześniejszej daty."],
 effectiveTo:["Koniec ważności","Nie odnawia się automatycznie. Nowy profil otrzymuje rok ważności; można edytować datę. Zmiana prawa może wymagać wcześniejszej aktualizacji."],
 verificationNotes:["Uzgodnienia i wyjątki","Zapisz, kto i na jakiej podstawie dopuścił odstępstwa. Notatka nie wyłącza ograniczeń algorytmu."],
 minimumDailyRestHours:["Odpoczynek dobowy — prawo","Minimalna przerwa między pracą. Ogólna norma: 11 godzin. Zwiększenie zmniejsza dostępność, obniżenie może naruszać przepisy. Specjalne traktowanie stałej nocki wymaga sprawdzenia w regulaminie placówki."],
 minimumWeeklyRestHours:["Odpoczynek tygodniowy — prawo","Ogólna norma: 35 godzin nieprzerwanej przerwy obejmującej odpoczynek dobowy. To nie to samo co dwie wolne daty. Zwiększenie utrudnia obsadę; obniżenie wymaga prawidłowej podstawy wyjątku."],
 weeklyRestWindowType:["Jak szukać odpoczynku","Stały tydzień sprawdza kolejne okresy od kotwicy. Okno kroczące przesuwa kontrolowany okres o zadany krok i zwykle stawia więcej warunków. To sposób obliczeń, nie samodzielny przepis."],
 weeklyRestWindowLengthHours:["Długość kontrolowanego okresu","168 godzin to 7 dni. Inna długość zmienia sens kontroli; nie traktuj jej jako sposobu obejścia odpoczynku."],
 weeklyRestWindowStepHours:["Przesuwanie okresu kontroli","Mniejszy krok tworzy więcej nakładających się kontroli i może wydłużyć obliczenia. Dla stałego tygodnia typowo 168 godzin."],
 weeklyRestAnchorDayOfWeek:["Początek tygodnia kontroli","Dzień wyznaczający granicę okresów odpoczynku. Powinien odpowiadać właściwemu okresowi rozliczeniowemu, nie być wybierany dla wygody solwera."],
 weeklyRestAnchorTime:["Godzina granicy tygodnia","Przesuwa początek kontroli odpoczynku. 00:00 oznacza północ wybranego dnia."],
 weeklyRestAttributionMode:["Przerwa na granicy okresów","W całości w oknie wymaga całej przerwy wewnątrz okresu. Część wspólna liczy część przerwy mieszczącą się w oknie; ta zmiana może wpływać na ocenę przerw na granicach."],
 weeklyRestReuseAcrossWindowsAllowed:["Ponowne liczenie przerwy","Dopuszcza użycie tej samej przerwy w kilku oknach. Nie tworzy dodatkowego odpoczynku. Sprawdź zgodność metody rozliczenia."],
 maximumAbsoluteDailyWorkHours:["Bezwzględny limit dobowy","Limit sumy znanej pracy, także spoza grupy. Przekroczenie blokuje plan. Brak wartości oznacza brak tego dodatkowego ograniczenia, nie zgodę prawną na dowolnie długą pracę. Dopuszczalny limit zależy od systemu zatrudnienia."],
 maximumAbsoluteSegmentHours:["Bezwzględny limit ciągłej pracy","Ogranicza długość nieprzerwanego odcinka. Może wymagać przekazania opieki kolejnej osobie. Wartość opcjonalna; nie zastępuje limitów całego czasu pracy."],
 weeklyRestExceptionEnabled:["Wyjątek — wymaga podstawy","Pozwala użyć skróconego odpoczynku według poniższych warunków. To nie jest uniwersalne zezwolenie prawne. PIP wskazuje szczególne przypadki, w których minimum może wynosić 24 godziny."],
 weeklyRestExceptionMinimumHours:["Minimum skróconego odpoczynku","Mniejsza wartość ułatwia obsadę kosztem odpoczynku. Poniżej 24 godzin występuje szczególne ryzyko niezgodności; nawet 24 godziny wymagają właściwej podstawy."],
 weeklyRestExceptionMaximumOccurrencesPerCycle:["Ile razy wolno użyć wyjątku","Twardy limit liczby odstępstw w całym horyzoncie. Zwiększanie nie zastępuje zgody na odstępstwa."],
 weeklyRestExceptionMinimumGapHours:["Odstęp między wyjątkami","Minimalny czas między użyciami wyjątku. Większy odstęp ogranicza kumulację skróconych odpoczynków."],
 weeklyRestCompensationRequired:["Odpoczynek wyrównawczy","Włącza kontrolę odrobienia skróconego odpoczynku według wymiaru i terminu. Podstawa i warunki muszą odpowiadać właściwym przepisom."],
 weeklyRestCompensationHours:["Ile odpoczynku oddać","Czas dodatkowej przerwy wymaganej po wyjątku. Zwiększenie zmniejsza późniejszą dostępność."],
 weeklyRestCompensationDeadlineHours:["Kiedy oddać odpoczynek","Termin zapewnienia odpoczynku wyrównawczego. Krótszy termin mocniej ogranicza układ kolejnych dni."],
 preferredAfternoonHandoverTime:["Życzenie: pora zmiany","Preferowana godzina przekazania opieki, np. 17:00. Jest miękka: generator może wybrać inną godzinę, aby zachować twarde reguły."],
 preferredMaximumSegmentHours:["Życzenie: długość dyżuru","Po przekroczeniu rośnie ocena niedogodności. Nie jest zakazem — do zakazu służy bezwzględny limit odcinka."],
 preferredWeekendSplitHours:["Życzenie: podział weekendu","Punkt odniesienia dla równowagi weekendów. Obowiązkowe wzorce i stałe dyżury mają pierwszeństwo; ten parametr ich nie przesuwa."],
 requiredWorkDaysPerWeek:["Dni pracy — reguła placówki","Znana praca we wszystkich grupach, szkole i obie daty nocki zajmują dni. Dotychczasowy model wymaga 5 dni dla osoby podstawowej; pomocniczy stały plan ma wyjątek. Nie jest to uniwersalny wymóg dla każdego rodzaju zatrudnienia."],
};
for(const key of ["afternoonHandoverPenaltyWeight","weekendImbalancePenaltyWeight","splitDayPenaltyWeight","longSegmentPenaltyWeight","preferredUnavailabilityPenaltyWeight"])
 RULE_HELP[key]=["Zaawansowana waga historyczna","Obecny solver porównuje cele w ustalonej kolejności, a nie za pomocą tej liczby. Zmiana samej wagi nie gwarantuje zmiany planu. Dwa kolejne wolne dni ustaw w Weekendach; po wygenerowaniu użyj Spróbuj ulepszyć podział. Nie zwiększaj liczb w ciemno."];

export function ruleRisk(name:string,value:unknown):string|null {
 const n=Number(String(value??"").replace(",","."));
 if(value!=="" && Number.isFinite(n)) {
  if(name==="requiredWorkDaysPerWeek" && n!==5) return "Zmieniono standard 5 dni pracy. Wynik zgodny z ustawieniami nie oznacza zgodności prawnej.";
  if(name==="minimumDailyRestHours" && n<11) return "Poniżej ogólnej normy 11 h. Wymaga sprawdzenia podstawy prawnej.";
  if(name==="minimumWeeklyRestHours" && n<35) return "Poniżej ogólnej normy 35 h. Sam wpis nie legalizuje wyjątku.";
  if(name==="weeklyRestExceptionMinimumHours" && n<24) return "Poniżej 24 h — szczególne ryzyko naruszenia odpoczynku.";
  if(name==="weeklyRestWindowLengthHours" && n!==168) return "Okres różny od 7 dni. Sprawdź sposób rozliczania odpoczynku.";
 }
 return null;
}
