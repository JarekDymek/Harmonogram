# RAPORT SPÓJNOŚCI DOKUMENTACJI PROJEKTU

## 1. Cel raportu

Raport sprawdza, czy dokumentacja projektu opisuje jeden spójny, jednoznaczny i możliwy do zaimplementowania system generowania harmonogramów.

Analizie podlegają:

* zgodność definicji,
* zgodność reguł krytycznych,
* zgodność reguł preferowanych,
* zgodność danych wejściowych z modelem danych,
* zgodność algorytmu z walidatorem,
* zgodność testów z wymaganiami,
* kompletność przypadków brzegowych,
* możliwość jednoznacznego przekształcenia dokumentacji w kod.

Raport nie zastępuje decyzji użytkownika i nie rozstrzyga kwestii prawnych.

---

## 2. Zasady analizy

Dla każdego problemu wskazano identyfikator, ważność, pliki i sekcje, opis, konsekwencje, decyzję wymaganą od użytkownika oraz możliwe warianty rozstrzygnięcia.

Poziomy ważności:

* `KRYTYCZNY` – problem uniemożliwia jednoznaczną implementację albo może prowadzić do niepoprawnych harmonogramów,
* `WYSOKI` – problem nie blokuje całego systemu, ale dopuszcza różne interpretacje ważnej reguły,
* `ŚREDNI` – problem dotyczy niepełnego opisu, przypadku brzegowego lub terminologii,
* `NISKI` – problem dotyczy głównie czytelności, nazewnictwa lub organizacji dokumentacji.

---

# I. PODSUMOWANIE OGÓLNE

## 1. Stan dokumentacji

**Wynik: `NIEGOTOWA DO IMPLEMENTACJI`.**

Dokumentacja zawiera dojrzały opis celu, rozdział generatora od walidatora, model sześciotygodniowej rotacji, dynamiczne obliczanie zapotrzebowania oraz szeroki zestaw testów. Nie jest jednak możliwe jednoznaczne przełożenie jej na kod bez podjęcia decyzji biznesowych i prawnych.

Blokujące są przede wszystkim:

* sprzeczność między stałymi godzinami opieki w `ZASADY.md` i `WALIDACJA.md` a dynamiczną konfiguracją w późniejszych dokumentach,
* jednoczesne traktowanie kroku 30 minut jako stałej i parametru,
* brak prawnie zatwierdzonych wartości ograniczeń przy obowiązku pełnej zgodności prawnej,
* konflikt stałych tygodniowych przydziałów godzin ze zmiennym zapotrzebowaniem,
* niejednoznaczna semantyka zastępowania i częściowego modyfikowania planu przez wyjątki,
* kilka źródeł reguły liczby dni pracy,
* brak danych potrzebnych do sprawdzenia odpoczynków na początku i końcu cyklu,
* niewystarczająco określona niezależność kalkulatora zapotrzebowania i walidatora.

## 2. Statystyka problemów

| Ważność | Liczba |
|---|---:|
| KRYTYCZNY | 8 |
| WYSOKI | 13 |
| ŚREDNI | 10 |
| NISKI | 1 |
| **Łącznie** | **32** |

## 3. Najważniejsze problemy

1. `P-001` – stałe przedziały opieki są sprzeczne z modelem dynamicznym.
2. `P-002` – krok 30 minut jest jednocześnie stałą pierwszej wersji i parametrem użytkownika.
3. `P-003` – wartości prawne są robocze, a system ma gwarantować zgodność z prawem.
4. `P-004` – stałe przydziały tygodniowe nie współgrają operacyjnie ze zmiennym zapotrzebowaniem.
5. `P-005` – wyjątki nie mają jednoznacznej operacji zastąpienia, dodania lub usunięcia.
6. `P-006` – liczba dni pracy ma kilka źródeł i nieustalone pierwszeństwo.
7. `P-007` – nie ma pełnego kontekstu do sprawdzenia odpoczynków na granicach cyklu.
8. `P-008` – walidator może współdzielić błędnie obliczone zapotrzebowanie z generatorem.
9. `P-009` – weekendy i niedostępność mają różny priorytet w różnych dokumentach.
10. `P-012` – niezgodność sumy godzin nie ma jednoznacznego statusu systemowego.

## 4. Rejestr wykrytych problemów

| ID | Ważność | Pliki i dokładne sekcje | Opis i konsekwencje | Decyzja użytkownika i warianty |
|---|---|---|---|---|
| `P-001` | KRYTYCZNY | `ZASADY.md` I.3; `WALIDACJA.md` 7; `DANE_WEJSCIOWE.md` 2–3, 9–10, 13–15; `ALGORYTM.md` II.3; `TESTY_I_SCENARIUSZE.md` T-010–T-016, T-092 | `ZASADY.md` podaje godziny opieki jako regułę krytyczną, a `WALIDACJA.md` jako domyślne przedziały. Późniejsze dokumenty zakazują stałego schematu i wymagają obliczenia dla każdej daty. Implementacje mogą walidować ten sam dzień według dwóch różnych zbiorów slotów. | Czy godziny z `ZASADY.md` są regułą, jawną konfiguracją bazową czy tylko przykładem? Wariant A: wyłącznie dane dynamiczne; B: jawny profil bazowy zatwierdzany przez użytkownika; C: stały schemat pierwszej wersji, co wymaga wycofania wymagań dynamicznych. |
| `P-002` | KRYTYCZNY | `ZASADY.md` I.7; `WALIDACJA.md` 3 i 5; `DANE_WEJSCIOWE.md` 2, 5, 14; `ALGORYTM.md` II.1, IV.3; `MODEL_DANYCH.md` II.2, VIII; test T-002 | Krok 30 minut jest krytyczną stałą w dwóch dokumentach, lecz równocześnie polem `timeStepMinutes` i parametrem konfiguracyjnym. Walidator opisuje wyłącznie pełne i półgodzinne granice. Nie wiadomo, czy ma obsłużyć krok 15 lub 20 minut. | Czy pierwsza wersja ma krok zawsze 30 minut, czy dowolny krok zatwierdzony w konfiguracji? Wariant A: stałe 30; B: dozwolony zbiór kroków; C: dowolny dzielnik doby, ze zmianą walidatora i testów. |
| `P-003` | KRYTYCZNY | `Specyfikacja.md` Cel projektu; `ZASADY.md` I.8; `WALIDACJA.md` 12–13; `MODEL_DANYCH.md` IV.1, VIII.14; testy T-050–T-055 | System ma gwarantować zgodność z prawem, ale 11 i 35 godzin są wartościami roboczymi. Model słusznie stwierdza, że wartość niezweryfikowana nie może być twardym ograniczeniem, co pozostawia generator bez kompletnej konfiguracji krytycznej. | Czy do czasu weryfikacji prawnej generowanie ma być blokowane? Wariant A: blokada produkcyjna; B: tryb demonstracyjny wyraźnie niezatwierdzony; C: użytkownik zatwierdza wersję konfiguracji prawnej przed każdym generowaniem. |
| `P-004` | KRYTYCZNY | `ZASADY.md` I.5; `DANE_WEJSCIOWE.md` 7, 10–11, 13–14; `ALGORYTM.md` IV.3, VII.2 i pseudokod; `MODEL_DANYCH.md` `Educator.weeklyAssignedMinutes`; testy T-020–T-023, T-083 | Zapotrzebowanie zmienia się między tygodniami, natomiast każdy wychowawca ma jedno pole tygodniowego przydziału w wersji konfiguracji. Dokumentacja nakazuje przerwać generowanie przy różnicy, więc dni specjalne mogą uczynić znaczną część cyklu z definicji niewykonalną. Nie wiadomo, czy jest to zamierzona reguła biznesowa. | Czy przydziały są stałe dla wszystkich tygodni? Wariant A: stałe i każda różnica blokuje; B: przydziały per tydzień; C: odrębna kategoria pracy bilansuje różnicę; D: dłuższy okres rozliczeniowy; E: jawna zmiana przydziałów po wystąpieniu dnia specjalnego. |
| `P-005` | KRYTYCZNY | `DANE_WEJSCIOWE.md` 6–9, 12; `MODEL_DANYCH.md` `NoInternatCareInterval`, `SpecialDay.replacesWeeklyPlan`; `TESTY_I_SCENARIUSZE.md` T-014–T-016 | Hierarchia poziomów jest jasna, ale operacja wpisu nie jest. Nie wiadomo, czy wyjątek zastępuje cały dzień, jeden przedział, dodaje okres, czy usuwa okres. Boolean `replacesWeeklyPlan` nie opisuje częściowych zmian ani wielu jednoczesnych wpisów. | Ustalić semantykę operacji. Wariant A: każdy wyższy poziom zastępuje cały dzień; B: jawne operacje `REPLACE_DAY`, `ADD_INTERVAL`, `REMOVE_INTERVAL`, `REPLACE_INTERVAL`; C: pełny stan dnia po scaleniu wykonywanym przed zapisem. |
| `P-006` | KRYTYCZNY | `ZASADY.md` I.4; `WALIDACJA.md` 10; `ALGORYTM.md` IV.4, V.2; `MODEL_DANYCH.md` `Educator.requiredWorkDaysPerWeek` i `OrganizationalRulesConfiguration.requiredWorkDaysPerWeek`; testy T-024–T-027 | Reguła „dokładnie 5” jest stała w części dokumentów, parametrem globalnym w innych i polem per wychowawca w modelu. Nie określono pierwszeństwa ani dopuszczalności wyjątków. | Wariant A: zawsze 5 dla wszystkich w pierwszej wersji; B: wartość globalna; C: wartość per wychowawca; D: wyjątki per tydzień. Należy też wskazać źródło autorytatywne. |
| `P-007` | KRYTYCZNY | `ALGORYTM.md` IV.12; `WALIDACJA.md` 12–13; `MODEL_DANYCH.md` `ScheduleConfigurationVersion`, `ScheduleCycle`; test T-052 oraz kryterium XIII.12 | Algorytm ma sprawdzać przejście między cyklami, „jeżeli harmonogram ma być powtarzalny”, ale model nie zawiera flagi powtarzalności ani poprzedzającego/następującego przydziału. Nie określono też granic odpoczynku tygodniowego dla pierwszego i ostatniego tygodnia. | Czy cykl jest zawsze zapętlony? Wariant A: cykl powtarzalny i kontrola tydzień 6 → 1; B: cykl skończony z danymi poprzedzającymi i następującymi; C: osobne tryby z wymaganym kontekstem brzegowym. |
| `P-008` | KRYTYCZNY | `WALIDACJA.md` 1, 7, 19; `ALGORYTM.md` I.3, VIII; `MODEL_DANYCH.md` III.4–5 i X; test T-100 | Model przekazuje walidatorowi „obliczone zapotrzebowanie”. Jeżeli generator i walidator ufają temu samemu błędnemu wynikowi kalkulatora, niezależny walidator nie wykryje błędu obliczania zapotrzebowania. | Wariant A: walidator niezależnie przelicza zapotrzebowanie z surowej konfiguracji; B: osobno waliduje pochodzenie i wynik kalkulatora; C: dwa niezależne kalkulatory. Minimum wymaga wskazania, że derived data nie jest bezwarunkowo zaufane. |
| `P-009` | WYSOKI | `ZASADY.md` II.1–4; `WALIDACJA.md` 9, 14–15, 17; `ALGORYTM.md` IV.6, IV.10–11 | Rotacja, obsada weekendu i dostępność są „WYSOKIE”, a generator i walidator traktują je jak krytyczne. Definicja „WYSOKI” dopuszcza pominięcie tylko niejasno: „zawsze, jeśli istnieje rozwiązanie”. | Wariant A: wszystkie wymienione reguły są krytyczne; B: pozostają wysokie i mogą być naruszone z ostrzeżeniem; C: rozdzielić reguły weekendowe/`HARD` od preferencji. |
| `P-010` | WYSOKI | `WALIDACJA.md` 14; `ALGORYTM.md` IV.10; test T-062 | Walidator zabrania odwrócenia zmian między sobotą a niedzielą „jeżeli” narusza ono odpoczynek, co może sugerować dopuszczalność bez naruszenia. Algorytm i test zabraniają odwrócenia bezwarunkowo. | Czy zakaz jest bezwarunkowy? Wariant A: zawsze ta sama rola przez oba dni; B: odwrócenie dozwolone po spełnieniu odpoczynku; C: ustawienie konfiguracyjne. |
| `P-011` | WYSOKI | `MODEL_DANYCH.md` `Educator.canWorkWeekends`; `ZASADY.md` II.1–2; `ALGORYTM.md` IV.11 | Obowiązkowa rotacja trzech osób wymaga, aby każda pracowała w czterech weekendach cyklu. `canWorkWeekends = false` czyni wzorzec niemożliwym, lecz nie opisano, czy jest to niedozwolona konfiguracja czy legalny powód braku rozwiązania. | Wariant A: pole usunąć w pierwszej wersji; B: wymagać `true` dla całej trójki przy walidacji wejścia; C: wyłączyć sztywną rotację, gdy pole ma wartość `false`. |
| `P-012` | WYSOKI | `DANE_WEJSCIOWE.md` 11 i 14; `ALGORYTM.md` VII i pseudokod; test T-080 | Niezgodna suma przydziałów jest błędem danych przed solverem, ale pseudokod zwraca `BRAK_ROZWIAZANIA`. Test jawnie akceptuje dwa statusy. Interfejs i API nie mogą mieć jednoznacznego kontraktu. | Wybrać `DANE_NIEPOPRAWNE` albo `BRAK_ROZWIAZANIA` oraz wskazać granicę odpowiedzialności walidacji wejścia i solvera. Technicznie korzystne jest rozróżnienie błędu arytmetycznego danych od udowodnionej niewykonalności modelu, ale decyzja należy do użytkownika. |
| `P-013` | WYSOKI | `Specyfikacja.md` Założenia projektowe; `ALGORYTM.md` Cel, VII.4; `MODEL_DANYCH.md` `GenerationRun`; test T-084 | Specyfikacja mówi, że algorytm „zawsze znajduje” harmonogram, gdy istnieje, natomiast limit czasu dopuszcza brak zakończenia. Nie wiadomo też, czy poprawny kandydat znaleziony przed limitem można pokazać bez dowodu optymalności. | Wariant A: brak limitu dla pierwszej wersji; B: limit i status nieukończenia bez publikacji; C: publikacja poprawnego, lecz nieudowodnionego jako optymalny kandydata z osobnym statusem. |
| `P-014` | WYSOKI | `ZASADY.md` I.6; `WALIDACJA.md` 6; `ALGORYTM.md` IV.5; `MODEL_DANYCH.md` `minimumSegmentMinutes`; testy T-030–T-033 | Dwie sekcje ustanawiają 2 godziny bez wyjątku, a algorytm nazywa je parametrem i wartością roboczą. | Czy 2 godziny są stałą pierwszej wersji czy parametrem organizacyjnym? Jeżeli parametr, walidator i testy muszą używać wartości konfiguracji, a nie liczby 2. |
| `P-015` | WYSOKI | `ZASADY.md` I.2; `WALIDACJA.md` 7–8; `ALGORYTM.md` IV.1; `MODEL_DANYCH.md` `EducationalGroup.defaultRequiredStaffCount`, `RequiredCareInterval.requiredStaffCount`, `allowDoubleStaffing` | Istnieją trzy mechanizmy określania obsady: dokładnie jedna osoba, domyślna liczba grupy, liczba per przedział i boolean zezwalający na podwójną obsadę. Nie wiadomo, który ustala wymóg, a który tylko dopuszcza nadmiar. | Wariant A: wyłącznie `requiredStaffCount` per przedział; B: jawny domyślny count grupy dziedziczony przez przedziały; C: osobno minimum i maksimum obsady. `allowDoubleStaffing` wymaga zdefiniowanej semantyki. |
| `P-016` | WYSOKI | `MODEL_DANYCH.md` `LegalRulesConfiguration`; `Specyfikacja.md` Cel; `ZASADY.md` I.8 | Konfiguracja prawna nie przechowuje jurysdykcji, podstawy prawnej, daty obowiązywania, źródła, osoby zatwierdzającej ani zakresu stosowania. Sam status i notatki nie pozwalają audytować gwarancji prawnej. | Ustalić minimalny ślad prawny. Warianty: pola strukturalne w konfiguracji; wersjonowany załącznik/rekord weryfikacji; blokada generowania bez zatwierdzonej referencji. |
| `P-017` | WYSOKI | `MODEL_DANYCH.md` `ScheduleConfigurationVersion`, `EducationalGroup`, konfiguracje reguł, `ScheduleCycle`, `ScheduleWeek`, raporty | Relacje są zapisane dwukierunkowo jako identyfikator rodzica i tablica dzieci. `requiredWorkDaysPerWeek` jest także zduplikowane. Bez źródła prawdy mogą powstać różne zbiory powiązań. | Wskazać kierunek autorytatywny każdej relacji i zasady integralności. Wariant A: wyłącznie referencja dziecko → rodzic; B: obie strony z transakcyjną spójnością; C: tablice jako wyliczane widoki. |
| `P-018` | WYSOKI | `WALIDACJA.md` 2 i 20; `MODEL_DANYCH.md` `ValidationMessage.ruleId`, `ConflictReport.conflictingRuleIds`; wszystkie dokumenty reguł | Raporty i testy wymagają identyfikatorów reguł, ale dokumentacja nie nadaje regułom stabilnych ID. Numery sekcji nie są bezpiecznym identyfikatorem po edycji dokumentu. | Zatwierdzić rejestr stabilnych ID i mapowanie każdej reguły generatora, walidatora i testów. |
| `P-019` | WYSOKI | `Specyfikacja.md` Cel; `ZASADY.md` I.1 i V; `ALGORYTM.md` VII.2–3; `MODEL_DANYCH.md` `ConflictReport`; testy T-080–T-083 | Wymagany jest możliwie najmniejszy zbiór konfliktów, lecz nie określono, czy musi być matematycznie minimalny, minimalny przez inkluzję, czy tylko diagnostycznie mały. Nie ma testu minimalności ani pola wiarygodności raportu. | Wariant A: dokładny minimalny rdzeń; B: rdzeń minimalny przez inkluzję; C: najlepszy dostępny raport z oznaczeniem `EXACT/APPROXIMATE`. |
| `P-020` | WYSOKI | `ZASADY.md` II.4; `WALIDACJA.md` 9; `MODEL_DANYCH.md` `EducatorUnavailability`; testy T-040–T-043 | Nie określono hierarchii i łączenia niedostępności z różnych zakresów, zachowania przy nakładaniu `HARD` i `PREFERRED` ani znaczenia braku wpisu. | Ustalić, czy zakresy są sumowane czy zastępowane, że `HARD` ma pierwszeństwo nad `PREFERRED`, oraz czy brak niedostępności oznacza możliwość przydziału bez gwarancji pracy. |
| `P-021` | WYSOKI | `Specyfikacja.md` Zakres pierwszej wersji; `ZASADY.md` II.1; `ALGORYTM.md` IV.11; `MODEL_DANYCH.md` Cel, IX; test T-065 | Specyfikacja mówi o automatycznych harmonogramach tygodniowych i nie wymienia sześciotygodniowego cyklu. Pozostałe dokumenty czynią cykl obowiązkowym. Model dodaje import/eksport JSON, a ręczną edycję pozostawia otwartą. | Potwierdzić, czy wynikiem pierwszej wersji jest zawsze cały sześciotygodniowy cykl, czy pojedynczy tydzień w kontekście cyklu. Oddzielnie oznaczyć import/eksport i ręczną edycję jako obowiązkowe albo przyszłe. |
| `P-022` | ŚREDNI | Wszystkie dokumenty, szczególnie `ZASADY.md` II–III, `WALIDACJA.md` 6, 14, `ALGORYTM.md` III–VI | „Zmiana”, „odcinek”, „slot”, „przedział”, „pracownik”, „wychowawca”, „pobyt poza internatem” i „brak potrzeby opieki” bywają używane zamiennie. Może to zmienić sposób liczenia segmentów i obsady. | Zatwierdzić słownik z jednoznacznym mapowaniem pojęć polskich i nazw modelu angielskiego. |
| `P-023` | ŚREDNI | `DANE_WEJSCIOWE.md` 4, 7–8, 12; `MODEL_DANYCH.md` `NoInternatCareInterval.eventType`, `SpecialDay.type` | Lista wydarzeń ma być otwarta, ale model pokazuje wartości podobne do enumów i nie posiada osobnego `customEventType`. Sam `description` może nie wystarczyć do raportowania rodzaju. | Wariant A: `eventType` jako dowolny tekst; B: enum + `customEventType`; C: wersjonowany słownik użytkownika. |
| `P-024` | ŚREDNI | `MODEL_DANYCH.md` `InternatOperatingInterval.scope`, `NoInternatCareInterval.scope`; porównawczo `EducatorUnavailability.scope` | Dla dwóch encji czasu nie podano dozwolonych wartości `scope` ani warunków wymagania `date`, `weekNumber` i `dayOfWeek`. | Zastosować jawny wspólny typ zakresu albo opisać osobne enumy i reguły warunkowe. |
| `P-025` | ŚREDNI | `MODEL_DANYCH.md` `InternatOperatingInterval`, `NoInternatCareInterval`, `SpecialDay`; Cel modelu | Encje wpływające na zapotrzebowanie nie wskazują `groupId`. Działa to dla jednej grupy, ale nie zapewnia obiecanej późniejszej rozbudowy, gdy grupy mają różne plany. | Wariant A: pola są wspólne dla projektu; B: przypisać je do grupy; C: wspólny profil z relacją wiele grup → profil. |
| `P-026` | ŚREDNI | `ZASADY.md` I.3; `MODEL_DANYCH.md` VIII.2; `ALGORYTM.md` II.2; `TESTY_I_SCENARIUSZE.md` II | Model wymaga `endTime > startTime`, więc odcinek przechodzący przez północ jest niemożliwy, ale zakaz nie jest jawny. Nie opisano też, czy nocni pracownicy są całkowicie poza modelem. | Potwierdzić zakaz odcinków przez północ w pierwszej wersji albo określić reprezentację daty końca. |
| `P-027` | ŚREDNI | `MODEL_DANYCH.md` `WorkAssignment.source/locked`, IX; `ALGORYTM.md` VI.7; `Specyfikacja.md` Zakres | Model przewiduje ręczne przydziały, blokady, stabilność oraz import/eksport, mimo że nie są jednoznacznie w zakresie pierwszej wersji. | Oznaczyć każde wymaganie jako pierwsza wersja albo przyszłość. Jeżeli przyszłość, pola mogą pozostać rezerwą, lecz nie mogą wpływać na kryteria akceptacji pierwszej wersji. |
| `P-028` | ŚREDNI | `MODEL_DANYCH.md` `WorkAssignment.durationMinutes`, `EducatorWeekSummary`, tablice `*Ids`, liczniki raportów | Część pól jest pochodna i może rozbiec się z danymi źródłowymi: czas trwania kontra start/koniec, podsumowania kontra przydziały, liczniki kontra komunikaty. | Ustalić, które pola są wyliczane, kiedy są materializowane i jak wykrywa się ich niespójność. |
| `P-029` | ŚREDNI | `WALIDACJA.md` 2; `ALGORYTM.md` VII–IX; `MODEL_DANYCH.md` statusy projektu, przebiegu, cyklu, raportu | Statusy polskie i angielskie dotyczą różnych poziomów, ale nie mają jawnej mapy. `ScheduleCycle.status`, `ValidationReport.status` i `inputValidationStatus` nie mają enumów. | Zatwierdzić osobne zbiory statusów dla projektu, wejścia, przebiegu solvera, harmonogramu i raportu walidacji. |
| `P-030` | ŚREDNI | `TESTY_I_SCENARIUSZE.md` T-014, T-053–T-054, T-065, T-074, T-080, T-101; porównanie z `WALIDACJA.md` 20 | Część testów nie ma kompletnych danych ani jednoznacznego statusu. T-014 zakłada godziny internatu bez podania ich; T-080 dopuszcza dwa statusy; testy odpoczynku tygodniowego i całego cyklu są szkicowe; brakuje testów pracy poza zapotrzebowaniem, obsady większej niż 1, zawinięcia cyklu i dokładnych komunikatów każdej reguły. | Uzupełnić dane, pojedynczy oczekiwany status i komunikaty; dodać brakujące testy po rozstrzygnięciu reguł. |
| `P-031` | ŚREDNI | `ZASADY.md` III.4; `WALIDACJA.md` 16; `ALGORYTM.md` VI.6–8; `MODEL_DANYCH.md` `OrganizationalRulesConfiguration`; testy T-072–T-074 | „Prostszy”, „regularny”, „łatwy do zapamiętania” i „stabilny” nie mają mierzalnej definicji. Model nie zawiera wag regularności/stabilności ani referencji do poprzedniego harmonogramu. | Zdefiniować mierniki, kolejność i wagi albo odłożyć te preferencje poza pierwszą wersję. |
| `P-032` | NISKI | Nazwa pliku `Specyfikacja.md`; odwołania do `SPECYFIKACJA.md` w poleceniach i dokumentacji | Na Windows nazwy działają bez rozróżniania wielkości liter, ale na systemie case-sensitive odwołania mogą nie wskazać pliku. | Ujednolicić nazwę i wszystkie odwołania przed pracą wieloplatformową. |

---

# II. ZGODNOŚĆ CELU I ZAKRESU

| Element zakresu | Ocena | Ustalenie |
|---|---|---|
| Jedna grupa | Zgodne dla pierwszej wersji | `Specyfikacja.md` i `MODEL_DANYCH.md` mówią o jednej aktywnej grupie. Model przygotowuje rozbudowę, lecz brak `groupId` w części encji zapotrzebowania (`P-025`). |
| Trzech wychowawców | Zgodne | Wszystkie wzorce weekendowe zakładają A, B, C. Model technicznie pozwala na więcej, co jest właściwe dla rozbudowy. |
| Sześciotygodniowy cykl | Częściowo zgodne | Jest obowiązkowy w zasadach, algorytmie, modelu i testach, ale nie został wymieniony w zakresie pierwszej wersji `Specyfikacja.md` (`P-021`). |
| Harmonogram zgodny z regułami | Zgodne jako cel | Szczegóły reguł nie są jeszcze spójne. |
| Brak zgadywania | Zgodne | Powtarza się we wszystkich warstwach. Niejednoznaczne dokumenty nadal wymuszałyby zgadywanie implementatora. |
| Niezależny generator i walidator | Zgodne jako intencja | Przepływ obliczonego zapotrzebowania osłabia niezależność (`P-008`). |
| Późniejsza rozbudowa | Zgodne jako cel | Model nie jest jeszcze w pełni gotowy na różne plany wielu grup (`P-025`). |
| Ręczna edycja | Nieustalony zakres | Model jej nie wyklucza przez `MANUAL` i `locked`, ale pierwsza wersja jej nie wymaga (`P-027`). |
| Import/eksport JSON | Rozszerzenie bez potwierdzenia | `MODEL_DANYCH.md` określa je jako wymaganie pierwszej wersji, choć nie ma go w `Specyfikacja.md` (`P-027`). |

Pierwsza wersja wymaga potwierdzenia, czy generuje pojedynczy tydzień, czy zawsze sześć powiązanych tygodni. Mechanizm rotacji i odpoczynków międzytygodniowych wskazuje, że pojedynczy tydzień bez kontekstu nie wystarcza.

---

# III. TERMINOLOGIA

## 1. Wykryte rozbieżności

* `wychowawca` i `pracownik` – `pracownik nocny` pojawia się jako osoba poza zakresem, ale nie jest encją modelu; należy jasno oddzielić go od `Educator`.
* `odcinek pracy`, `zmiana` i `przedział pracy` – „zmiana” bywa rolą weekendową, a „odcinek” ciągłym przypisaniem; nie powinny być synonimami.
* `slot` – jednostka dyskretna solvera; nie jest tym samym co przedział.
* `godziny funkcjonowania internatu` – obszar potencjalnej opieki, nie gotowe zapotrzebowanie.
* `godziny wymaganej opieki` i `zapotrzebowanie` – pierwsze oznacza przedziały, drugie powinno obejmować także liczbę wymaganych osób i sumę minut.
* `pobyt poza internatem` i `okres bez potrzeby opieki internatu` – drugie jest pojęciem szerszym, bo obejmuje także opiekę innych uprawnionych pracowników.
* `dostępność` i `niedostępność` – dokumenty przechodzą od ogólnej dostępności do wpisów `HARD/PREFERRED`; brak wpisu nie ma zdefiniowanej semantyki.
* `reguła wysokiego priorytetu` i `reguła krytyczna` – ich praktyczne zachowanie jest obecnie sprzeczne (`P-009`).
* `błąd`, `ostrzeżenie`, `informacja` – dobrze zdefiniowane w walidatorze, ale nie powinny być mieszane ze statusami przebiegu solvera.

## 2. Proponowany słownik

| Pojęcie polskie | Nazwa modelowa | Proponowana definicja |
|---|---|---|
| Projekt harmonogramu | `ScheduleProject` | Kontener wersji konfiguracji i historycznych wyników. |
| Wersja konfiguracji | `ScheduleConfigurationVersion` | Niemodyfikowalny po uruchomieniu generatora zestaw zatwierdzonych danych. |
| Grupa wychowawcza | `EducationalGroup` | Jednostka wychowanków, dla której oblicza się zapotrzebowanie. |
| Wychowawca | `Educator` | Osoba podlegająca przydziałowi pracy przez solver. |
| Godziny funkcjonowania | `InternatOperatingInterval` | Przedziały, w których grupa może wymagać opieki. |
| Przedział bez wymaganej opieki | `NoInternatCareInterval` | Część godzin funkcjonowania odejmowana przy wyliczaniu zapotrzebowania. |
| Zapotrzebowanie | `CalculatedCareRequirement` | Wynik obliczenia dla daty: wymagane przedziały, liczba osób i suma minut. |
| Przedział wymaganej opieki | `RequiredCareInterval` | Półotwarty przedział z wymaganą liczbą wychowawców. |
| Slot | brak trwałej encji | Najmniejsza jednostka czasu używana przez solver. |
| Odcinek pracy | `WorkAssignment` | Maksymalny ciąg kolejnych slotów jednego wychowawcy bez przerwy. |
| Dzień dzielony | cecha dnia/przydziałów | Dzień, w którym wychowawca ma co najmniej dwa rozłączne odcinki. |
| Rola weekendowa | `weekendRole` | `RANO`, `PO_POLUDNIU` albo `WOLNE` dla całego weekendu. |
| Niedostępność bezwzględna | `EducatorUnavailability/HARD` | Zakaz przydziału w przedziale. |
| Niedostępność preferowana | `EducatorUnavailability/PREFERRED` | Przydział dozwolony z karą. |
| Reguła krytyczna | stabilne `ruleId` | Ograniczenie, którego naruszenie unieważnia harmonogram. |
| Preferencja | stabilne `ruleId` | Kryterium oceny stosowane dopiero po spełnieniu reguł krytycznych. |

---

# IV. REGUŁY KRYTYCZNE

| ID reguły | Nazwa | Źródłowy dokument | Generator | Walidator | Model danych | Testy | Wynik zgodności |
|---|---|---|---|---|---|---|---|
| `REQ-COVERAGE-001` | Ciągłość opieki | `ZASADY.md` I.2 | `ALGORYTM.md` IV.1 | `WALIDACJA.md` 7 | `RequiredCareInterval`, `WorkAssignment` | T-005, T-006, właściwości | `SPRZECZNE` przez `P-001` |
| `REQ-STAFFING-001` | Brak niedozwolonej podwójnej obsady | `ZASADY.md` I.2 | IV.1 | 8 | count grupy, count przedziału, boolean | T-007, T-064 | `SPRZECZNE` przez `P-015` |
| `REQ-HOURS-001` | Dokładna liczba godzin | `ZASADY.md` I.5 | IV.3 | 11 | `weeklyAssignedMinutes` | T-020–T-023 | `SPRZECZNE` dla zmiennego popytu (`P-004`) |
| `REQ-DAYS-001` | Dokładnie pięć dni | `ZASADY.md` I.4 | IV.4, V.2 | 10 | dwa źródła wartości | T-024–T-027 | `SPRZECZNE` źródło konfiguracji (`P-006`) |
| `REQ-SEGMENT-MIN-001` | Minimalna długość odcinka | `ZASADY.md` I.6 | IV.5 | 6 | `minimumSegmentMinutes` | T-030–T-033 | `CZĘŚCIOWE` – stała czy parametr (`P-014`) |
| `REQ-TIME-STEP-001` | Krok 30 minut | `ZASADY.md` I.7 | II.1 | 5 | `timeStepMinutes` | T-001, T-002 | `SPRZECZNE` (`P-002`) |
| `REQ-UNAVAILABLE-001` | Niedostępność bezwzględna | `ZASADY.md` II.4 | IV.6 | 9 | `EducatorUnavailability/HARD` | T-040, T-041, T-043 | `CZĘŚCIOWE` – priorytet i scalanie (`P-009`, `P-020`) |
| `REQ-REST-DAILY-001` | Odpoczynek dobowy | `ZASADY.md` I.8, II.3 | IV.7, IV.12 | 12 | `minimumDailyRestMinutes` | T-050–T-052 | `CZĘŚCIOWE` – prawo i granice (`P-003`, `P-007`) |
| `REQ-REST-WEEKLY-001` | Odpoczynek tygodniowy | `ZASADY.md` I.8 | IV.8, IV.12 | 13 | konfiguracja prawna | T-053–T-055 | `CZĘŚCIOWE` – brak granic i danych brzegowych |
| `REQ-WEEKEND-001` | Obsada weekendowa | `ZASADY.md` II.1–3 | IV.10 | 14 | `WeekendRotationVariant` | T-060–T-064 | `SPRZECZNE` – priorytet i odwrócenie (`P-009`, `P-010`) |
| `REQ-ROTATION-001` | Rotacja sześciotygodniowa | `ZASADY.md` II.1–2 | IV.11 | 15 | `WeekendRotationVariant` | T-065, T-066 | `CZĘŚCIOWE` – wzorzec poprawny, status reguły nie |
| `REQ-WEEKEND-PAIR-001` | Ta sama para sobota/niedziela | `WALIDACJA.md` 14 | IV.10 | 14 | wariant + przydziały | T-063 | `KOMPLETNE` logicznie |
| `REQ-WEEKEND-ROLE-001` | Brak odwracania ról w weekend | `WALIDACJA.md` 14 | IV.10 | 14 | role wariantu | T-062 | `SPRZECZNE` brzmienie warunkowe (`P-010`) |
| `REQ-CROSS-WEEK-001` | Spójność między tygodniami | `ALGORYTM.md` IV.12 | IV.12 | częściowo 12–13 | brak pełnego kontekstu | T-052; brak wrap-around | `CZĘŚCIOWE` (`P-007`) |
| `REQ-NO-OUTSIDE-001` | Zakaz pracy poza zapotrzebowaniem | `ALGORYTM.md` IV.2 | IV.2 | `WALIDACJA.md` 4 | relacja przydział–wymóg pośrednia | brak testu dedykowanego | `CZĘŚCIOWE` |
| `REQ-NO-RELAX-001` | Zakaz łagodzenia reguł | `ZASADY.md` I.1 | I.1, V.5, VII | walidator odrzuca błędy | brak osobnego pola | właściwości, T-100–T-101 | `CZĘŚCIOWE` – brak testu każdej reguły i stabilnych ID |

Najważniejsze braki przekrojowe:

* żadna reguła nie ma zatwierdzonego stabilnego identyfikatora źródłowego (`P-018`),
* praca poza zapotrzebowaniem nie ma dedykowanego testu,
* testy nie wymagają jednoznacznego komunikatu dla każdej reguły, mimo wymogu `WALIDACJA.md` 20,
* weekendy i niedostępność zmieniają klasę ważności między dokumentami,
* parametry prawne nie mogą być uznane za zatwierdzone.

---

# V. REGUŁY WEEKENDOWE

## 1. Ocena założeń

| Założenie | Ocena |
|---|---|
| Weekend obejmuje sobotę i niedzielę | Jednoznaczne. |
| Pracuje dwóch wychowawców, trzeci ma wolne oba dni | Jednoznaczne w algorytmie i walidatorze; w `ZASADY.md` ma tylko wysoki priorytet (`P-009`). |
| Ta sama para i te same role w oba dni | Jednoznaczne w algorytmie; warunkowe brzmienie zakazu odwrócenia w walidatorze wymaga poprawy (`P-010`). |
| Podział 8 + 8 | Preferencja, nie ograniczenie krytyczne. Zgodne. |
| Granice co 30 minut | Zgodne przy kroku 30, ale konfigurowalność kroku jest nierozstrzygnięta (`P-002`). |
| Minimum 2 godziny | Zgodne jako obecna wartość, nierozstrzygnięte jako stała/parametr (`P-014`). |
| Wpływ weekendu na dni wolne | Opisany w algorytmie. Dla osoby pracującej w weekend wynikają trzy dni pracy i dwa wolne od poniedziałku do piątku. |
| Każda para pracuje dwa razy | Spełnione przez kolejność wariantów. |
| Role pary odwracają się przy drugim spotkaniu | Spełnione przez kolejność wariantów. |
| Każdy ma dwa wolne weekendy | Spełnione przez kolejność wariantów. |

## 2. Weryfikacja kolejności wariantów

| Tydzień | Rano | Po południu | Wolny | Para | Wspólny weekend pary | Zgodność odwrócenia ról |
|---:|---|---|---|---|---:|---|
| 1 | A | B | C | A–B | 1 | Wzorzec początkowy |
| 2 | A | C | B | A–C | 1 | Wzorzec początkowy |
| 3 | B | C | A | B–C | 1 | Wzorzec początkowy |
| 4 | B | A | C | A–B | 2 | TAK – odwrotność tygodnia 1 |
| 5 | C | A | B | A–C | 2 | TAK – odwrotność tygodnia 2 |
| 6 | C | B | A | B–C | 2 | TAK – odwrotność tygodnia 3 |

Podana kolejność sześciu wariantów jest matematycznie poprawna:

* C ma wolne tygodnie 1 i 4,
* B ma wolne tygodnie 2 i 5,
* A ma wolne tygodnie 3 i 6,
* każda para pojawia się dwa razy,
* role w każdej parze są odwrócone przy drugim wspólnym weekendzie.

Przesunięcie punktu startowego cyklu zachowuje te własności, jeżeli cykl jest traktowany kołowo. Nie rozstrzyga to jednak `P-007`: nie wiadomo, czy cały harmonogram jest zawsze zapętlony.

Brakuje jednoznacznej odpowiedzi, jak ustalana jest granica między „rano” a „po południu”. `preferredWeekendSplitTime` i preferencja 8 + 8 pozwalają solverowi ją optymalizować, ale rola weekendowa nie określa sama z siebie godziny przekazania.

---

# VI. LICZBA DNI PRACY

Dokumentacja zgodnie definiuje dzień pracy jako datę, w której wychowawca ma co najmniej jeden odcinek. Dwa lub więcej odcinków tej samej daty nadal oznaczają jeden dzień pracy.

| Przypadek | Ustalenie |
|---|---|
| Jeden odcinek | Jeden dzień pracy. |
| Dzień dzielony | Jeden dzień pracy; każdy odcinek osobno podlega minimum. |
| Wolny weekend | Przy dokładnie pięciu dniach osoba musi pracować od poniedziałku do piątku. |
| Pracujący weekend | Dwa dni weekendowe + trzy dni robocze; z pięciu dni roboczych dwa muszą być wolne. |
| Dzień specjalny | Może zmienić dostępne zapotrzebowanie i uczynić wymóg pięciu dni niewykonalnym. |
| Tydzień ze zmienionym zapotrzebowaniem | Nadal obowiązuje dokładna liczba dni i godzin; dokumentacja nakazuje przerwanie, gdy bilans się nie zgadza. |
| Praca poza zapotrzebowaniem dla „dobicia” dnia | Zabroniona przez `ALGORYTM.md` IV.2 i pośrednio przez `WALIDACJA.md` 4. |

Niejednoznaczności:

* nie wiadomo, czy `5` jest stałą, globalną konfiguracją czy wartością per wychowawca (`P-006`),
* nie opisano wyjątków od pięciu dni; brak opisu nie może być interpretowany jako zgoda na wyjątek,
* przy dniach specjalnych nie wolno dodać pracy poza zapotrzebowaniem, zatem poprawny bilans może nie istnieć,
* `Educator.requiredWorkDaysPerWeek` i `OrganizationalRulesConfiguration.requiredWorkDaysPerWeek` mogą się różnić.

Decyzja użytkownika jest konieczna w sprawie autorytatywnego źródła oraz tego, czy pierwsza wersja dopuszcza jakikolwiek wyjątek.

---

# VII. PRZYDZIAŁ GODZIN I ZMIENNE ZAPOTRZEBOWANIE

Zgodne założenia:

* każdy wychowawca ma indywidualny przydział,
* suma przydziałów ma równać się rzeczywistemu zapotrzebowaniu konkretnego tygodnia,
* zapotrzebowanie może zmieniać się między tygodniami,
* godziny szkoły i dni specjalne są zmienne,
* generator nie przenosi godzin, nie zmienia przydziałów i nie ignoruje zdarzeń.

Dokumentacja określa obecne zachowanie: przy różnicy generator ma przerwać działanie i podać tydzień, daty, popyt, przydział, różnicę i zdarzenia. Nie rozwiązuje to jednak konfliktu operacyjnego: pojedyncze `weeklyAssignedMinutes` na wersję konfiguracji zakłada taką samą wartość we wszystkich sześciu tygodniach, podczas gdy zapotrzebowanie celowo może się różnić.

Wymagające decyzji warianty:

1. Przydziały są identyczne w każdym tygodniu, a każdy brak równości blokuje generowanie.
2. Przydziały są definiowane osobno dla każdego tygodnia cyklu.
3. Dzień specjalny powoduje utworzenie jawnie zatwierdzonej nowej wersji przydziałów.
4. Różnicę obsługuje inna, nazwana kategoria pracy, obecnie nieobecna w modelu.
5. Rozliczenie odbywa się w okresie dłuższym niż tydzień, co zmienia regułę dokładnych godzin tygodniowych.

Raport nie wybiera żadnego wariantu. Do czasu decyzji `P-004` blokuje projekt modelu i solvera.

---

# VIII. GODZINY POBYTU WYCHOWANKÓW POZA INTERNATEM

## 1. Pokrycie przypadków

| Przypadek | Dokumentacja | Ocena |
|---|---|---|
| Podstawowy plan tygodniowy | `DANE_WEJSCIOWE.md` 5 | Jest. |
| Różne dni tygodnia | 5 | Jest. |
| Różne tygodnie cyklu | 6 | Jest. |
| Konkretna data | 7 | Jest. |
| Brak zajęć | 8.2 | Jest. |
| Skrócone/późniejsze zajęcia | 7–8 | Jest. |
| Uroczystość, wycieczka, praktyki | 4, 7–8 | Są. |
| Kilka okresów poza internatem | 5, 8.4 | Są. |
| Częściowy powrót | 8.4; test T-014 | Jest jako przykład. |
| Opieka innych pracowników | 4 | Jest jako rodzaj powodu. |
| Sprzeczne wyjątki | 14; test T-016 | Są odrzucane. |

## 2. Hierarchia

Kolejność jest zgodna w `DANE_WEJSCIOWE.md` i `MODEL_DANYCH.md`:

1. konkretna data,
2. konkretny tydzień cyklu,
3. podstawowy plan tygodniowy,
4. jawna konfiguracja bazowa.

## 3. Niejednoznaczność zastępowania

Pole `SpecialDay.replacesWeeklyPlan` rozróżnia tylko „zastępuje/nie zastępuje”. Brakuje odpowiedzi:

* co oznacza `false` – dodanie wszystkich okresów czy częściowa korekta,
* jak usunąć jeden okres odziedziczony z planu,
* jak zastąpić tylko jeden z kilku okresów,
* co zrobić z kilkoma wyjątkami tej samej daty,
* czy `operatingIntervalIds` i `noCareIntervalIds` zastępują oba typy planu niezależnie,
* jak `sourcePriority` współdziała z ustaloną hierarchią.

Bez jawnej operacji albo pełnego stanu dnia nie można jednoznacznie obliczyć zapotrzebowania (`P-005`).

---

# IX. CZAS I PRZEDZIAŁY

| Element | Ocena |
|---|---|
| Format `HH:MM` na granicy systemu | Jednoznaczny. |
| Minuty od północy / sloty wewnętrznie | Jednoznaczny, dopuszcza dwa równoważne formaty; implementacja powinna wybrać jeden kanoniczny. |
| Przedziały półotwarte | Jednoznaczne w `ALGORYTM.md`; testy T-005 i T-041 je potwierdzają. |
| Długość odcinka | Różnica końca i początku dla przedziału półotwartego. |
| Sąsiadujące odcinki | Nie tworzą luki ani nakładania; odcinki tej samej osoby powinny zostać scalone w maksymalny ciąg, choć nie zapisano tego wprost w modelu. |
| Przerwa | Co najmniej jeden nieprzydzielony danej osobie slot rozdziela odcinki. |
| Krok 30 minut | Sprzeczny status: stała/parametr (`P-002`). |
| Przejście przez północ | Nieopisane; warunek `endTime > startTime` je odrzuca (`P-026`). |
| Granica tygodni | Wymagana w algorytmie i jednym teście. |
| Koniec/początek cyklu | Wymagany warunkowo, ale brak danych i trybu powtarzalności (`P-007`). |

Ponieważ noc 22:00–06:00 jest obsługiwana przez innych pracowników, pierwsza wersja może zabronić odcinków przez północ, ale musi to być jawna decyzja. Nie wolno wywnioskować jej wyłącznie z przykładowych godzin.

---

# X. ODPOCZYNEK DOBOWY

Dokumentacja definiuje odpoczynek jako czas od końca ostatniego odcinka pracy jednej daty do początku pierwszego odcinka następnej daty. Dni dzielone nie zmieniają tej pary granicznej: wewnętrzne przerwy nie są opisane jako odpoczynek dobowy.

Zgodne elementy:

* wartość jest konfiguracyjna, a 11 godzin ma charakter roboczy,
* walidacja obejmuje kolejne dni,
* niedziela → poniedziałek nie może być pominięta,
* kilka odcinków dnia wymaga wyboru ostatniego i pierwszego,
* testy 11 i 8 godzin mają prawidłowe wyniki arytmetyczne.

Braki:

* wartość 11 godzin nie jest prawnie zatwierdzona (`P-003`),
* pierwszy dzień cyklu nie ma poprzedzającego odcinka, jeżeli cykl nie jest zapętlony,
* ostatni dzień nie ma następującego odcinka,
* brak flagi powtarzalności i kontekstu brzegowego (`P-007`),
* nie rozstrzygnięto, czy kontrola ma analizować każdą kolejną parę odcinków chronologicznie także przy nietypowych danych przechodzących przez północ.

---

# XI. ODPOCZYNEK TYGODNIOWY

Wartość 35 godzin jest robocza i przechowywana w konfiguracji prawnej. Wyjątek może zostać użyty tylko po jawnym włączeniu, co jest spójne w walidatorze, algorytmie, modelu i teście T-055.

Dokumentacja nie określa:

* chwili początku i końca tygodnia pracy,
* czy odpoczynek musi mieścić się w tygodniu kalendarzowym,
* czy może przechodzić przez granicę niedziela–poniedziałek,
* okna, w którym należy znaleźć najdłuższy nieprzerwany odpoczynek,
* danych poprzedzających tydzień 1 i następujących po tygodniu 6,
* zachowania dla cyklu skończonego i powtarzanego.

Testy T-053 i T-054 nie zawierają pełnych harmonogramów ani wartości oczekiwanych poza ogólnym „poprawny/błąd”. Reguła wymaga decyzji prawnej i algorytmicznej przed implementacją.

---

# XII. MINIMALNA I MAKSYMALNA DŁUGOŚĆ ODCINKA

| Wartość | Klasyfikacja w dokumentacji | Ocena |
|---|---|---|
| Minimum 2 godziny | Krytyczne w `ZASADY.md` i `WALIDACJA.md`; parametr/wartość robocza w algorytmie i modelu | Niespójne źródło i możliwość zmiany (`P-014`). |
| Preferowane maksimum 8 godzin | Preferencja i kara; test T-073 | Spójne: nie jest limitem krytycznym. |
| Bezwzględne maksimum | Opcjonalne `maximumAbsoluteSegmentMinutes` po weryfikacji prawnej | Poprawnie odróżniono „brak zweryfikowanej wartości” od „braku limitu”. |

Żaden dokument nie powinien traktować 8 godzin jako krytycznego maksimum. Obecnie tego nie robi. Problemem pozostaje to, że bez zweryfikowanego limitu bezwzględnego aplikacja nie może twierdzić, że sprawdziła wszystkie ograniczenia prawne.

---

# XIII. NIEDOSTĘPNOŚĆ WYCHOWAWCÓW

Model obsługuje:

* niedostępność cykliczną (`RECURRING_WEEKLY`),
* niedostępność tygodnia cyklu (`CYCLE_WEEK`),
* konkretną datę (`SPECIFIC_DATE`),
* typ bezwzględny (`HARD`),
* typ preferowany (`PREFERRED`),
* przedziały zgodne z ogólną reprezentacją czasu.

Brakuje:

* hierarchii lub reguły sumowania wpisów z różnych zakresów,
* zachowania przy nakładaniu `HARD` i `PREFERRED`,
* wykrywania zduplikowanych lub sprzecznych wpisów,
* jawnej zasady, że brak niedostępności oznacza możliwość przydziału, ale nie gwarancję przydziału,
* walidacji zgodności `canWorkWeekends` z obowiązkowym cyklem.

Jeżeli choć jeden z trzech wychowawców ma `canWorkWeekends = false`, pełny opisany cykl nie może zostać utworzony. Dokumentacja musi określić, czy jest to niepoprawna konfiguracja wejściowa, udowodniony brak rozwiązania, czy sygnał do zastosowania innego modelu rotacji.

---

# XIV. GENERATOR I WALIDATOR

## 1. Deklarowany przepływ

| Element | Generator | Walidator |
|---|---|---|
| Dane wejściowe | Zwalidowana, wersjonowana konfiguracja i obliczone zapotrzebowanie | Zwalidowana konfiguracja, obliczone zapotrzebowanie i kandydat |
| Zadanie | Zbudowanie modelu, wyszukanie kandydatów i optymalizacja preferencji | Zebranie wszystkich możliwych naruszeń bez poprawiania wyniku |
| Wynik | Kandydat, status solvera, wynik preferencji albo raport konfliktu | `POPRAWNY`/`NIEPOPRAWNY`, błędy, ostrzeżenia i informacje |
| Rozbieżność | Nie może sam uznać kandydata za gotowy | Błąd krytyczny powoduje `BLAD_WEWNETRZNY`; harmonogram nie jest publikowany |

Walidator ma wystarczające typy danych do sprawdzania:

* przydziałów godzin,
* dni pracy,
* niedostępności,
* odcinków i odpoczynków,
* weekendów,
* rotacji całego cyklu.

Nie ma jednak zagwarantowanej niezależności obliczenia zapotrzebowania. Jeżeli `CalculatedCareRequirement` jest traktowane jako zaufane wejście obu modułów, błąd odejmowania przedziałów może pozostać niewykryty. Niezależny walidator powinien co najmniej sprawdzić derived requirement względem surowych `InternatOperatingInterval`, `NoInternatCareInterval`, `SpecialDay` i hierarchii źródeł. Wymaga to decyzji `P-008`, nie automatycznej zmiany dokumentów.

Należy także rozstrzygnąć, czy podsumowania zapisane w `EducatorWeekSummary` są wejściem do walidatora, czy jedynie jego wynikiem. Dla niezależności walidator powinien umieć wyliczyć je z `WorkAssignment`, lecz raport nie przyjmuje tego jako zatwierdzonej decyzji.

---

# XV. STATUSY SYSTEMU

## 1. Wykryte poziomy

| Poziom | Statusy w dokumentacji | Problem |
|---|---|---|
| Projekt | `DRAFT`, `CONFIGURED`, `GENERATED`, `ARCHIVED` | Poprawny osobny poziom, ale znaczenie `GENERATED` przy niepoprawnej walidacji nie jest opisane. |
| Walidacja wejścia | `DANE_NIEPOPRAWNE`, `inputValidationStatus` | Brak angielskiego enumu i pełnej listy. |
| Przebieg solvera | `PENDING`, `RUNNING`, `VALID_SOLUTION`, `NO_SOLUTION`, `TIME_LIMIT`, `INTERNAL_ERROR` | `VALID_SOLUTION` może oznaczać tylko kandydata przed niezależną walidacją. |
| Publiczny wynik generatora | `BRAK_ROZWIAZANIA`, `NIE_ZAKONCZONO_WYSZUKIWANIA`, `BLAD_WEWNETRZNY`, `POPRAWNY` | Miesza przebieg solvera, stan harmonogramu i walidację. |
| Walidacja harmonogramu | `POPRAWNY`, `NIEPOPRAWNY` | Jednoznaczne w `WALIDACJA.md`. |
| Harmonogram cyklu | `ScheduleCycle.status` | Brak listy dozwolonych wartości. |
| Raport walidacji | `ValidationReport.status` | Brak jawnego enumu, choć logicznie odpowiada `POPRAWNY/NIEPOPRAWNY`. |

## 2. Proponowana mapa do decyzji

| Znaczenie | Status polski | Status modelowy | Poziom |
|---|---|---|---|
| Dane odrzucone przed solverem | `DANE_NIEPOPRAWNE` | np. `INVALID_INPUT` | Walidacja wejścia |
| Solver udowodnił niewykonalność | `BRAK_ROZWIAZANIA` | `NO_SOLUTION` | `GenerationRun` |
| Solver osiągnął limit | `NIE_ZAKONCZONO_WYSZUKIWANIA` | `TIME_LIMIT` | `GenerationRun` |
| Solver znalazł kandydata | brak jednoznacznego polskiego statusu | `VALID_SOLUTION` lub lepiej semantycznie `CANDIDATE_FOUND` | `GenerationRun` przed walidacją |
| Walidator zaakceptował | `POPRAWNY` | np. `VALID` | `ValidationReport`/harmonogram |
| Walidator odrzucił | `NIEPOPRAWNY` | np. `INVALID` | `ValidationReport` |
| Awaria generatora/modelu | `BLAD_WEWNETRZNY` | `INTERNAL_ERROR` | Przebieg systemowy |

To jest propozycja mapy, nie zmiana wymagań. Szczególnie `P-012` wymaga wyboru statusu dla niezgodnej sumy godzin.

---

# XVI. FUNKCJA OCENY I PREFERENCJE

| Preferencja | Model danych | Testy | Możliwość obliczenia | Ocena |
|---|---|---|---|---|
| Podział popołudnia o 17:00 | czas + waga | T-070, T-071 | Tak | Spójne jako konfiguracja. |
| Weekend 8 + 8 | czas podziału + waga nierówności | T-060, T-061 | Tak | Spójne. |
| Odcinki ponad preferowane 8 h | wartość + waga | T-073 | Tak | Spójne jako preferencja. |
| Minimalizacja dni dzielonych | `splitDayPenaltyWeight` | T-072 | Tak | Spójne. |
| Niedostępność preferowana | typ + waga | T-042, T-074 | Tak | Wymaga reguły łączenia wpisów (`P-020`). |
| Regularność | brak miernika/wagi | brak testu liczbowego | Nie jednoznacznie | Nieimplementowalne bez definicji. |
| Czytelność/łatwość zapamiętania | brak | brak | Nie | Pojęcia jakościowe. |
| Stabilność wobec poprzedniej wersji | brak referencji i wagi | brak | Nie w obecnym modelu | Oznaczona jako przyszła, ale model nie zapewnia danych. |
| Deterministyczny remis | ID wychowawców i daty | T-090 | Tak po ustaleniu pełnego porządku | Należy określić kanoniczne sortowanie ID i wszystkich nierozstrzygniętych cech. |

Wagi istnieją dla pięciu kar, lecz nie dla regularności i stabilności. Należy zdecydować, czy:

* zdefiniować mierzalne cechy, np. sumę różnic godzin rozpoczęcia w analogicznych dniach,
* traktować regularność wyłącznie jako tie-breaker z jednoznacznym wzorem,
* odłożyć ją poza pierwszą wersję.

Żadna preferencja nie może działać przed spełnieniem ograniczeń krytycznych; ta zasada jest spójna.

---

# XVII. WYKRYWANIE BRAKU ROZWIĄZANIA

## 1. Rozróżnienie stanów

| Stan | Obecna definicja | Ocena |
|---|---|---|
| Niepoprawne dane | Braki, sprzeczności, niezgodny krok | Jasne, poza przypadkiem sumy godzin (`P-012`). |
| Udowodniony brak rozwiązania | Solver dowiódł braku kandydata spełniającego ograniczenia | Jasne. |
| Nieukończone wyszukiwanie | Limit czasu, brak dowodu niewykonalności | Jasne. |
| Błąd wewnętrzny | Walidator odrzucił kandydata lub awaria modelu | Jasne jako idea, brak pełnej mapy statusów. |
| Brak konfiguracji prawnej | Model wykrywa niezweryfikowane wartości | Brak osobnego statusu i decyzji, czy blokuje (`P-003`). |

## 2. Minimalny zbiór konfliktów

Wymaganie jest wartościowe, ale może wymagać:

* wsparcia solvera dla unsat core/assumptions,
* ponownego uruchamiania modelu z podzbiorami ograniczeń,
* rozróżnienia rdzenia minimalnego przez inkluzję od rdzenia o najmniejszej liczbie elementów,
* mapowania ograniczeń solvera na stabilne ID reguł i pola wejściowe,
* dodatkowego czasu obliczeniowego po stwierdzeniu niewykonalności.

Obowiązkowe dla pierwszej wersji jest przedstawienie konkretnego raportu konfliktu. Nie jest jednoznaczne, czy matematycznie najmniejszy rdzeń jest obowiązkowy. To ryzyko technologiczne należy rozstrzygnąć przed wyborem solvera, bez usuwania wymagania (`P-019`).

---

# XVIII. MODEL DANYCH

| Encja | Cel i źródło wymagania | Generator | Walidator | Raportowanie | Braki/ryzyka logiczne | Potencjalnie zbędne w V1 |
|---|---|---|---|---|---|---|
| `ScheduleProject` | Kontener projektu; specyfikacja i wersjonowanie | Wybiera aktywną wersję | Nie bezpośrednio | Historia/status | Status projektu wobec błędnej walidacji | Trwały projekt może być uproszczony w prototypie |
| `ScheduleConfigurationVersion` | Niemodyfikowalny snapshot danych | Główne wejście | Główne wejście | Ślad wersji | Brak trybu powtarzalności, kontekstu brzegowego, strefy czasu; dwukierunkowe relacje | `createdBy` zależne od systemu użytkowników |
| `EducationalGroup` | Jedna grupa V1, wiele w przyszłości | Ogranicza zapotrzebowanie | Sprawdza groupId | Grupowanie wyników | `defaultRequiredStaffCount` konkuruje z count przedziału; `educatorIds` dwukierunkowe | `active` przy wersjonowanym snapshotcie wymaga semantyki |
| `Educator` | Osoba, godziny, dni, weekendy | Zmienna decyzyjna i limity | Kontrole osobowe | Podsumowania | Jedno `weeklyAssignedMinutes`; duplikat dni; `canWorkWeekends` konfliktuje z rotacją | `active` w zamrożonej wersji |
| `EducatorUnavailability` | Zakazy/preferencje | Ograniczenia/kary | Kontrola nakładania | Komunikaty | Brak hierarchii i scalania; brak jawnego `configurationVersionId` poza relacją przez osobę | Brak |
| `InternatOperatingInterval` | Zakres potencjalnej opieki | Kalkulator popytu | Powinien służyć do niezależnego przeliczenia | Źródło diagnostyki | Brak `groupId`, enumu `scope` i zasad zastępowania | Brak |
| `NoInternatCareInterval` | Okres odejmowany | Kalkulator popytu | Niezależna kontrola kalkulacji | Wyjaśnienie popytu | Brak operacji merge, `groupId`, jawnego custom type; niejasne `sourcePriority` | Brak |
| `SpecialDay` | Wyjątek daty | Wybór źródła popytu | Sprawdzenie hierarchii | Opis zdarzeń | `replacesWeeklyPlan` niewystarczające; brak `groupId`; wiele wpisów | Brak |
| `CalculatedCareRequirement` | Pochodny popyt daty | Bezpośrednie wejście | Nie może być bezwarunkowo zaufane | Raport popytu | Ryzyko wspólnego błędu; brak odcisku źródeł/pełnej ścieżki obliczenia | Materializacja opcjonalna |
| `RequiredCareInterval` | Dokładny przedział i count | Ograniczenie slotów | Kontrola pokrycia | Raport dnia | Autorytet count wobec default/boolean | Brak |
| `LegalRulesConfiguration` | Parametry prawne | Twarde ograniczenia po zatwierdzeniu | Twarde kontrole | Audyt | Brak podstawy prawnej, jurysdykcji, okresu obowiązywania, zatwierdzającego | Brak |
| `OrganizationalRulesConfiguration` | Reguły i wagi | Ograniczenia/score | Reguły/ostrzeżenia | Wyjaśnienie preferencji | Duplikat dni; brak wag regularności/stabilności; niejasne double staffing | Brak |
| `WeekendRotationVariant` | Role tygodnia cyklu | Ustala weekend | Kontroluje cykl | Podsumowanie | Brak jawnego przypisania do konkretnych dat; boundary wynika z przydziałów | Brak |
| `GenerationRun` | Przebieg solvera | Zapisuje wykonanie | Pośrednio | Diagnostyka | Brak dowodu optymalności/bound, typu minimalności konfliktu; statusy wymagają mapy | `solverName/version` nadal pożądane dla audytu |
| `ScheduleCycle` | Wynik sześciu tygodni | Wynik | Przedmiot walidacji | Prezentacja | Brak enumu statusu i flagi powtarzalności | Brak |
| `ScheduleWeek` | Tydzień cyklu | Organizuje przydziały | Kontrole tygodniowe | Widok tygodnia | `assignmentIds` + `scheduleWeekId` tworzą podwójne źródło | Brak |
| `WorkAssignment` | Ciągły odcinek pracy | Wynik solvera | Główne dane kontroli | Harmonogram | `durationMinutes` pochodne; brak daty/czasu końca dla overnight; `MANUAL/locked` przyszłe | `MANUAL`, `locked` bez decyzji V1 |
| `EducatorWeekSummary` | Pochodne statystyki | Może być wyliczone po generacji | Powinno być wynikiem niezależnych obliczeń | Raport | Ryzyko zaufania pochodnym; brak wersji kalkulacji | Trwałe przechowywanie opcjonalne |
| `ValidationReport` | Wynik walidatora | Nie | Tworzony | Główny raport | Brak enumu statusu i wersji walidatora | Brak |
| `ValidationMessage` | Pojedynczy błąd/ostrzeżenie/info | Nie | Tworzony | Szczegóły | Brak rejestru `ruleId`; wartości mają nieokreślony typ | Brak |
| `ConflictReport` | Diagnostyka niewykonalności | Tworzony | Może weryfikować strukturę, nie dowód | Raport | Brak `EXACT/APPROXIMATE`, rodzaju minimalności i mapy do pól | Brak |

Relacje nie są wszędzie jednoznaczne. Największe ryzyko tworzą pary:

* `ScheduleConfigurationVersion.groupIds` ↔ `EducationalGroup.configurationVersionId`,
* `EducationalGroup.educatorIds` ↔ `Educator.configurationVersionId`,
* `ScheduleCycle.weekIds` ↔ `ScheduleWeek.scheduleCycleId`,
* `ScheduleWeek.assignmentIds` ↔ `WorkAssignment.scheduleWeekId`,
* `ValidationReport.messageIds` ↔ `ValidationMessage.validationReportId`,
* `CalculatedCareRequirement.requiredIntervalIds` ↔ `RequiredCareInterval.careRequirementId`,
* `GenerationRun.conflictReportId` ↔ `ConflictReport.generationRunId`.

Model logiczny powinien wskazać jedną stronę jako źródło prawdy lub wymagać atomowej spójności obu stron. Raport nie projektuje schematu bazy danych.

---

# XIX. TESTY

## 1. Rzeczywista liczba scenariuszy

Plik zawiera **58** nagłówków scenariuszy `T-xxx`. Wszystkie użyte identyfikatory są unikalne. Luki w numeracji rozdzielają grupy i nie powodują błędu, choć konwencja nie została opisana.

## 2. Pokrycie reguł

| Reguła | Test poprawny | Test niepoprawny | Graniczny | Cały cykl | Między tygodniami | Deterministyczność |
|---|---|---|---|---|---|---|
| Ciągłość opieki | T-005, właściwość | T-006 | 30-min luka T-006 | Niepełny | Nie | Nie dotyczy |
| Podwójna obsada | T-005 | T-007, T-064 | Styk T-005 | Nie | Nie | Nie dotyczy |
| Dokładne godziny | T-021 | T-022, T-023 | ±1,5 h; brak ±30 min osobno | Nie | Nie | Pośrednio T-090 |
| Pięć dni | T-024, T-025 | T-026, T-027 | Dzień dzielony T-025 | Pośrednio | Nie | Nie |
| Minimum odcinka | T-030 | T-031, T-032 | Dokładnie 2 h | Nie | Nie | Nie |
| Krok czasu | T-001 | T-002 | 14:45 przy 30 min | Nie | Nie | Nie |
| Niedostępność HARD | T-041 | T-040, T-043 | Koniec na granicy | Nie | Nie | Nie |
| Odpoczynek dobowy | T-050 | T-051 | Dokładnie 11 h | Nie | T-052 | Nie |
| Odpoczynek tygodniowy | T-053 szkic | T-054, T-055 szkice | Wyjątek niewłączony | Nie | Brak pełnego | Nie |
| Weekend | T-060, T-061 | T-062–T-064 | 8,5 + 7,5 | T-065 | Nie | Nie |
| Rotacja | T-065 | T-066 | Brak | T-065/T-066 | Tylko w cyklu | Nie |
| Praca poza popytem | Brak | Brak | Brak | Brak | Brak | Brak |
| Dni specjalne | T-010–T-015 | T-016, T-083 | Częściowy powrót T-014 | Nie | Nie | Nie |
| Zakaz łagodzenia | T-101 ogólny | T-100 | Brak per reguła | Nie | Nie | T-090 pośrednio |
| Preferencje | T-070–T-073 | Nie są błędami krytycznymi | T-071, T-073 | Brak | Brak | T-074/T-090 częściowo |

## 3. Problemy testów

* T-014 nie podaje godzin funkcjonowania internatu, choć oczekuje `06:00–08:00` i `16:00–22:00`; test korzysta z ukrytego założenia.
* T-053, T-054 i T-065 nie zawierają pełnych danych wejściowych, więc nie są jeszcze wykonywalnymi przypadkami.
* T-074 nie podaje wag ani oczekiwanego zwycięzcy.
* T-080 dopuszcza dwa statusy, przez co nie jest testem jednoznacznego kontraktu.
* T-101 nie zastępuje wymaganego poprawnego i niepoprawnego przypadku dla każdej reguły.
* Brakuje testu zakazu pracy poza zapotrzebowaniem.
* Brakuje testu `requiredStaffCount > 1` oraz jawnie dozwolonej podwójnej obsady.
* Brakuje testu przejścia tydzień 6 → tydzień 1 dla cyklu powtarzalnego.
* Brakuje testów konfliktów kilku niedostępności o różnych zakresach i typach.
* Brakuje jednoznacznych oczekiwanych `ruleId` i pełnych komunikatów dla większości błędów.
* Wartości liczbowe w kompletnych przykładach są arytmetycznie poprawne: 79,5 h, 11 h, 8 h, 8,5 + 7,5 h i obliczenia popytu.

---

# XX. WERYFIKACJA WARTOŚCI PRZYKŁADOWYCH

| Wartość | Oczekiwana klasyfikacja | Ustalenie i rozbieżności |
|---|---|---|
| Szkoła `08:00–14:30` | Przykład demonstracyjny | Tak w danych, algorytmie i testach; `ZASADY.md` I.3 przedstawia wynikające przedziały jak stałą (`P-001`). |
| Opieka `06:00–08:00`, `14:30–22:00` | Wynik przykładowej konfiguracji | Stała w `ZASADY.md`, „domyślna” w walidatorze, przykład w późniejszych dokumentach – niespójne. |
| Weekend `06:00–22:00` | Jawna konfiguracja/przykład | Stała w `ZASADY.md` i domyślna w walidatorze, konfigurowalna w danych – niespójne. |
| `79,5` godziny | Przykład demonstracyjny | Jednoznacznie oznaczone jako przykład w danych i testach. |
| A 24, B 27, C 28,5 h | Przykład testowy | Jednoznacznie testowe; suma poprawna. |
| Weekend `06:00–14:00`, `14:00–22:00` | Przykład realizacji preferencji 8 + 8 | Prawidłowo opisane jako przypadek testowy, nie stała. |
| Podział popołudnia 17:00 | Preferencja konfiguracyjna | Spójne jako preferencja; konkretna waga jest przykładowa. |
| Odpoczynek dobowy 11 h | Wartość robocza wymagająca weryfikacji prawnej | Walidator nazywa ją domyślną; model przechowuje parametr. Nie jest potwierdzona. |
| Odpoczynek tygodniowy 35 h | Wartość robocza wymagająca weryfikacji prawnej | Jednoznacznie „do czasu weryfikacji”, ale bez decyzji o blokadzie. |
| Minimum odcinka 2 h | Reguła krytyczna albo parametr organizacyjny – nierozstrzygnięte | Stała w zasadach/walidacji, wartość robocza w algorytmie (`P-014`). |
| Preferowane maksimum 8 h | Preferencja | Spójne; nie jest limitem prawnym ani krytycznym. |

Najważniejsza klasyfikacyjna sprzeczność dotyczy godzin opieki. Pozostałe dokumenty poprawnie odróżniają `79,5` godziny i godziny szkoły od stałych systemu.

---

# XXI. KWESTIE PRAWNE WYMAGAJĄCE WERYFIKACJI

Poniższa tabela nie zawiera interpretacji prawa. Wskazuje wyłącznie założenia dokumentacji, które wymagają osobnej weryfikacji przez uprawnioną osobę.

| Kwestia | Dokument i sekcja | Wartość robocza / obecny zapis | Wpływ na algorytm | Status |
|---|---|---|---|---|
| Minimalny odpoczynek dobowy | `ZASADY.md` I.8; `WALIDACJA.md` 12; `MODEL_DANYCH.md` IV.1 | 11 godzin | Zakaz określonych par późna/poranna, także między tygodniami | `DO WERYFIKACJI PRAWNEJ` |
| Minimalny odpoczynek tygodniowy | `ZASADY.md` I.8; `WALIDACJA.md` 13 | 35 godzin | Wymusza ciągły blok wolny i wpływa na dni pracy | `DO WERYFIKACJI PRAWNEJ` |
| Możliwość skrócenia odpoczynku tygodniowego | `WALIDACJA.md` 13; `ALGORYTM.md` IV.8; model IV.1 | Tylko po jawnym włączeniu; liczba minut nieustalona | Tworzy alternatywne ograniczenie krytyczne | `DO WERYFIKACJI PRAWNEJ` |
| Maksymalna długość pracy w dobie | `ZASADY.md` I.8; model IV.1 pośrednio | Brak zatwierdzonej wartości | Może ograniczać łączną pracę kilku odcinków tego samego dnia | `DO WERYFIKACJI PRAWNEJ` |
| Maksymalna długość pojedynczego odcinka | `MODEL_DANYCH.md` `maximumAbsoluteSegmentMinutes`; `ALGORYTM.md` VI.3 | Brak wartości; 8 h jest tylko preferencją | Może zmienić dopuszczalność długich weekendowych odcinków | `DO WERYFIKACJI PRAWNEJ` |
| Stosowanie Kodeksu pracy do nauczycieli objętych Kartą Nauczyciela | `Specyfikacja.md` Cel; `ZASADY.md` I.8 | Dokumentacja nie rozstrzyga podstawy zatrudnienia i reżimu prawnego | Decyduje o katalogu ograniczeń i wyjątków | `DO WERYFIKACJI PRAWNEJ` |
| Szczególne reguły placówki działającej przez wszystkie dni tygodnia | `ZASADY.md` I.3, II.1–3 | Opieka także w weekendy; noc poza zakresem | Wpływa na rozkład dni wolnych i odpoczynków | `DO WERYFIKACJI PRAWNEJ` |
| Zasady wolnych weekendów | `ZASADY.md` II.1; `WALIDACJA.md` 15 | Dwa wolne weekendy w sześciu tygodniach | Ustala obowiązkową rotację | `DO WERYFIKACJI PRAWNEJ` |
| Pięciodniowy tydzień pracy | `ZASADY.md` I.4; `WALIDACJA.md` 10 | Dokładnie 5 dni co tydzień | Twarde ograniczenie per osoba i tydzień | `DO WERYFIKACJI PRAWNEJ` |
| Godziny ponadwymiarowe | `ZASADY.md` I.5; `DANE_WEJSCIOWE.md` 11 | Zakaz samodzielnej zmiany przydziału; brak osobnego modelu nadgodzin | Wpływa na możliwość obsługi zwiększonego popytu | `DO WERYFIKACJI PRAWNEJ` |
| Rozliczenie zmiennego popytu w tygodniach świątecznych/specjalnych | `DANE_WEJSCIOWE.md` 7, 11; test T-083 | Obecnie różnica blokuje generator | Może wymagać per-tygodniowych przydziałów lub innego okresu rozliczeniowego | `DO WERYFIKACJI PRAWNEJ` |
| Minimalny odcinek 2 godziny | `ZASADY.md` I.6; `WALIDACJA.md` 6 | 2 godziny | Ogranicza możliwe podziały i dokładny bilans | `DO WERYFIKACJI PRAWNEJ` w zakresie, w jakim ma wynikać z prawa; osobno do zatwierdzenia organizacyjnego |
| Praca w dniach i godzinach szkolnych/specjalnych | `DANE_WEJSCIOWE.md` 4–10 | Praca wychowawcy internatu tylko w czasie wymaganej opieki | Określa, czy inne obowiązki mogą wejść do przydziału godzin | `DO WERYFIKACJI PRAWNEJ` i organizacyjnej |

Bez zakończenia tej weryfikacji system może działać wyłącznie jako model demonstracyjny, chyba że użytkownik zdecyduje inaczej i formalnie zatwierdzi konfigurację prawną.

---

# XXII. BRAKUJĄCE DECYZJE UŻYTKOWNIKA

| Nr | Pytanie decyzyjne | Dlaczego i pliki | Możliwe warianty oraz konsekwencje | Rekomendacja techniczna bez rozstrzygania biznesowego |
|---:|---|---|---|---|
| 1 | Czy godziny opieki są zawsze wyliczane dynamicznie, czy istnieje stały/domyślny profil? | `P-001`; zasady, walidacja, dane | Dynamiczne: pełna elastyczność; jawny profil: szybsza konfiguracja, ale wymaga zatwierdzenia; stałe: usuwa obsługę dni specjalnych. | Jeżeli profil istnieje, przechowywać go jawnie i pokazywać źródło dla każdej daty. |
| 2 | Czy krok czasu w V1 zawsze wynosi 30 minut? | `P-002`; wszystkie warstwy czasu | Stałe 30: prostszy walidator; lista kroków: więcej testów; dowolny krok: największa złożoność i wymóg zgodności wszystkich minut. | Jedno pole kanoniczne nadal może istnieć, ale walidacja V1 może ograniczać jego wartość. |
| 3 | Czy brak prawnie zatwierdzonej konfiguracji blokuje generowanie? | `P-003`, `P-016`; specyfikacja, zasady, model | Blokada: brak fałszywej gwarancji; tryb demo: konieczne mocne oznaczenie; zatwierdzenie użytkownika: potrzebny ślad audytowy. | Oddzielić status konfiguracji prawnej od statusu solvera. |
| 4 | Czy przydział godzin jest taki sam w każdym tygodniu cyklu? | `P-004`; dane, model, algorytm | Stały i blokada; per tydzień; nowa wersja przydziału; inna kategoria pracy; dłuższy okres rozliczeniowy. Każdy wariant zmienia model ograniczeń. | Nie kodować `weeklyAssignedMinutes` jako jedynego źródła, dopóki decyzja nie zapadnie. |
| 5 | Jak dokładnie wyjątek modyfikuje plan? | `P-005`; dane i model | Pełne zastąpienie dnia; operacje add/remove/replace; zapis pełnego stanu dnia. | Najłatwiejszy do audytu jest jawny wynik dla całej daty, ale wybór semantyki jest biznesowy. |
| 6 | Które pole jest źródłem liczby dni pracy? | `P-006`; zasady, algorytm, model | Stałe 5; globalne; per wychowawca; per tydzień. | Pozostawić jedno autorytatywne źródło i walidować pozostałe reprezentacje jako pochodne. |
| 7 | Czy sześciotygodniowy cykl jest zawsze powtarzalny? | `P-007`; algorytm, model | Zawsze kołowy; skończony; dwa tryby. | Dodać jawny tryb oraz wymagane dane poprzedzające/następujące. |
| 8 | Czy walidator ma ponownie obliczać zapotrzebowanie z surowych danych? | `P-008`; walidator, algorytm, model | Pełne przeliczenie; walidacja śladu kalkulacji; drugi kalkulator. | Nie ufać bezwarunkowo `CalculatedCareRequirement`. |
| 9 | Czy weekendy i niedostępność `HARD` są krytyczne? | `P-009`; zasady kontra reszta | Krytyczne; wysokie z możliwością ostrzeżenia; rozdzielenie klas. | Wymagać jednoznacznego `ruleId` i severity dla każdej reguły. |
| 10 | Czy role sobota/niedziela mogą się odwrócić po zachowaniu odpoczynku? | `P-010`; walidacja, algorytm, testy | Nigdy; warunkowo; konfigurowalnie. | Zaimplementować dopiero po jednym oczekiwanym wyniku T-062. |
| 11 | Jak traktować `canWorkWeekends = false` przy trzech osobach? | `P-011`; model i rotacja | Niedozwolone wejście; legalny brak rozwiązania; inna rotacja. | Wykrywać konflikt przed solverem, jeśli sztywna rotacja pozostaje obowiązkowa. |
| 12 | Jaki status ma niezgodna suma godzin i zapotrzebowania? | `P-012`; dane, algorytm, T-080 | `DANE_NIEPOPRAWNE` albo `BRAK_ROZWIAZANIA`. | Rozdzielenie arytmetycznej walidacji danych od niewykonalności solvera daje czytelniejszy kontrakt. |
| 13 | Co zrobić po limicie czasu, jeśli istnieje poprawny kandydat? | `P-013`; specyfikacja i algorytm | Nie publikować; publikować jako nieoptymalny; nie stosować limitu. | Przechowywać dowód optymalności/bound i osobny status kandydata. |
| 14 | Czy minimum 2 godziny jest stałe czy konfigurowalne? | `P-014`; zasady, walidator, model | Stała V1; parametr globalny; parametr per grupa/wersja. | Walidator zawsze powinien czytać jedno zatwierdzone źródło. |
| 15 | Jak definiować wymaganą i maksymalną obsadę slotu? | `P-015`; zasady, model | Jeden count; dziedziczony default; osobne minimum/maksimum. | Boolean `allowDoubleStaffing` nie zastępuje liczbowego wymagania. |
| 16 | Jaki minimalny ślad prawny musi przechowywać konfiguracja? | `P-016`; model | Pola strukturalne; załącznik; zewnętrzny rejestr zatwierdzeń. | Przechowywać identyfikowalną wersję źródła i datę obowiązywania. |
| 17 | Która strona relacji ID jest autorytatywna? | `P-017`, `P-028`; model | Dziecko → rodzic; obie strony; tablice-widoki. | Preferować jedno źródło prawdy logicznej niezależnie od przyszłej bazy. |
| 18 | Jaki format mają stabilne identyfikatory reguł? | `P-018`; walidacja, model, testy | Globalny rejestr `REQ-*`; ID per dokument; wersjonowany katalog. | Użyć globalnych, niezmiennych ID niezależnych od numerów sekcji. |
| 19 | Jak rygorystycznie minimalny ma być raport konfliktu? | `P-019`; specyfikacja, algorytm | Najmniejsza liczba; minimalny przez inkluzję; przybliżony oznaczony. | Dodać poziom jakości/minimalności raportu. |
| 20 | Jak łączyć niedostępności i co oznacza brak wpisu? | `P-020`; zasady, model | Suma zakazów; hierarchia daty nad cyklem; pełne zastąpienie. Brak wpisu: dostępny albo dane niepełne. | Jawnie zdefiniować union/precedence i dominację `HARD`. |
| 21 | Czy wynikiem V1 jest tydzień czy cały cykl oraz czy JSON/manual są w V1? | `P-021`, `P-027`; specyfikacja i model | Pełny cykl; tydzień z kontekstem; funkcje persistence obecne lub przyszłe. | Kryteria akceptacji powinny odnosić się do jednego artefaktu wynikowego. |
| 22 | Czy przedziały mogą przechodzić przez północ? | `P-026`; czas i model | Zakaz V1; reprezentacja daty końca; rozbicie na dwa odcinki. | Dla V1 najpierw jawnie walidować wybrany wariant. |
| 23 | Jak mierzyć regularność, czytelność i stabilność? | `P-031`; zasady, algorytm, model | Wzory liczbowe; tie-breakery; odłożenie funkcji. | Każda wdrażana preferencja musi mieć wzór, wagę i test. |
| 24 | Jakie enumy statusów obowiązują na każdym poziomie? | `P-012`, `P-029`; algorytm, model, walidacja | Osobne enumy wejścia, przebiegu, harmonogramu i raportu; jedna mapa API. | Nie używać `POPRAWNY` jako statusu przebiegu solvera przed walidacją. |
| 25 | Czy zdarzenie niestandardowe ma własny typ strukturalny? | `P-023`; dane i model | Dowolny tekst; enum + custom; słownik użytkownika. | Zapewnić osobne pole od opisu narracyjnego. |
| 26 | Czy dane opieki są wspólne dla projektu czy przypisane do grupy? | `P-025`; model i przyszła rozbudowa | Wspólne; per grupa; wspólny profil wielokrotnego użycia. | Decyzja może być odłożona tylko wtedy, gdy granica rozbudowy zostanie jawnie opisana. |

---

# XXIII. MACIERZ ŚLEDZENIA WYMAGAŃ

Legenda: `KOMPLETNE`, `CZĘŚCIOWE`, `SPRZECZNE`, `BRAK`.

| ID wymagania | Opis | Źródłowy plik | Dane wejściowe | Model danych | Generator | Walidator | Test | Status |
|---|---|---|---|---|---|---|---|---|
| `REQ-COVERAGE-001` | Każdy wymagany slot ma obsadę | `ZASADY.md` I.2 | Przedziały popytu | Care requirement | Dokładna suma | Kontrola luk | T-005/006 | `SPRZECZNE` |
| `REQ-STAFFING-001` | Brak niedozwolonego nadmiaru obsady | I.2 | Count niejednoznaczny | Trzy źródła count | Suma slotu | Nakładanie | T-007/064 | `SPRZECZNE` |
| `REQ-HOURS-001` | Dokładne godziny per osoba/tydzień | I.5 | Przydziały | `weeklyAssignedMinutes` | Równość slotów | Suma odcinków | T-020–023 | `SPRZECZNE` |
| `REQ-DAYS-001` | Dokładna liczba dni | I.4 | Niejasne źródło | Dwa pola | Warunek per tydzień | Liczenie dat | T-024–027 | `SPRZECZNE` |
| `REQ-SEGMENT-MIN-001` | Minimalny odcinek | I.6 | Parametr/stała | Pole config | Ograniczenie | Kontrola | T-030–033 | `CZĘŚCIOWE` |
| `REQ-TIME-STEP-001` | Granice zgodne z krokiem | I.7 | Krok | `timeStepMinutes` | Sloty | Hardcoded 30 | T-001/002 | `SPRZECZNE` |
| `REQ-UNAVAILABLE-001` | HARD nigdy nie naruszane | II.4 | Wpisy scope | Encja unavailability | Zakaz | Nakładanie | T-040/041/043 | `CZĘŚCIOWE` |
| `REQ-REST-DAILY-001` | Minimalny odpoczynek dobowy | I.8 | Legal config | Pole minut | Ograniczenie | Kontrola | T-050–052 | `CZĘŚCIOWE` |
| `REQ-REST-WEEKLY-001` | Minimalny odpoczynek tygodniowy | I.8 | Legal config | Pola standard/wyjątek | Ograniczenie | Kontrola | T-053–055 | `CZĘŚCIOWE` |
| `REQ-WEEKEND-001` | Dwie osoby i jedna wolna | II.1 | Wariant startowy | Weekend variant | Role | Kontrola pary | T-060–064 | `SPRZECZNE` |
| `REQ-ROTATION-001` | Sześć wariantów, role odwrócone | II.1–2 | Start | 6 wariantów | Kolejność | Walidacja cyklu | T-065/066 | `CZĘŚCIOWE` |
| `REQ-CROSS-WEEK-001` | Kontrola granic tygodni/cyklu | `ALGORYTM.md` IV.12 | Brak trybu/kontekstu | Brak pól | Wymóg warunkowy | Niepełny | T-052 | `CZĘŚCIOWE` |
| `REQ-NO-OUTSIDE-001` | Brak pracy poza popytem | IV.2 | Popyt | Przydziały + care | Zakaz | Struktura | Brak | `CZĘŚCIOWE` |
| `REQ-SPECIAL-DAY-001` | Wyjątki konkretnych dat | `DANE_WEJSCIOWE.md` 7–9 | Są | SpecialDay | Hierarchia | Walidacja wejścia | T-013–016 | `SPRZECZNE` |
| `REQ-NO-GUESSING-001` | Brak domyślania danych/reguł | `ZASADY.md` I.1 | Jawność | Wersja config | Przerwanie | Raport błędów | T-002/016/092 | `KOMPLETNE` jako zasada |
| `REQ-VALIDATOR-INDEP-001` | Niezależna walidacja | `WALIDACJA.md` 1,19 | Config + popyt | Raporty | Przekazuje kandydata | Sprawdza | T-100/101 | `SPRZECZNE` |
| `REQ-PREFERENCE-001` | Preferencje dopiero po hard constraints | `ZASADY.md` III | Wagi | Org config | Score | Ostrzeżenia | T-070–074 | `CZĘŚCIOWE` |
| `REQ-DETERMINISM-001` | Ten sam input → ten sam wynik | `ALGORYTM.md` I.2 | Seed/config | GenerationRun | Tie-break | Może porównać | T-090 | `KOMPLETNE` opisowo |
| `REQ-VERSIONING-001` | Wynik wskazuje niezmienną wersję | `MODEL_DANYCH.md` I.4 | Wersja | Relacje wersji | Używa snapshotu | Używa snapshotu | T-091 | `KOMPLETNE` opisowo |
| `REQ-CONFLICT-001` | Raport przy braku rozwiązania | `Specyfikacja.md`; `ALGORYTM.md` VII | Pola do weryfikacji | ConflictReport | Tworzy | Niejasna rola | T-080–083 | `CZĘŚCIOWE` |
| `REQ-STATUS-001` | Jednoznaczne statusy | Algorytm/walidacja | Status wejścia | Pola statusów | Status przebiegu | Status raportu | T-080/084/101 | `SPRZECZNE` |
| `REQ-LEGAL-001` | Tylko prawnie zatwierdzone ograniczenia | Spec/Zasady | Legal config | LegalRules | Hard constraints | Kontrole | T-050–055 | `SPRZECZNE` do weryfikacji |

---

# XXIV. REKOMENDOWANA KOLEJNOŚĆ POPRAWEK

## Etap 1 – problemy blokujące

1. Rozstrzygnąć `P-001` i ustalić jedno źródło godzin wymaganej opieki.
2. Rozstrzygnąć krok czasu (`P-002`).
3. Ustalić warunek uruchomienia przy niezweryfikowanej konfiguracji prawnej (`P-003`).
4. Rozstrzygnąć bilans zmiennego popytu i przydziałów (`P-004`).
5. Zdefiniować semantykę wyjątków (`P-005`).
6. Ustalić źródło i wyjątkowość reguły dni pracy (`P-006`).
7. Zdefiniować granice cyklu i dane do odpoczynków (`P-007`).
8. Zapewnić niezależne sprawdzenie obliczonego zapotrzebowania (`P-008`).

## Etap 2 – problemy wymagające doprecyzowania

1. Ujednolicić priorytet weekendów i niedostępności.
2. Ustalić zakaz/warunek odwrócenia ról weekendowych.
3. Rozstrzygnąć `canWorkWeekends`, minimum odcinka i wielokrotną obsadę.
4. Ustalić statusy błędów danych, solvera i walidacji.
5. Ustalić zachowanie przy limicie czasu i wymagany poziom minimalności konfliktu.
6. Zdefiniować scalanie niedostępności i znaczenie braku wpisu.
7. Potwierdzić artefakt wynikowy pierwszej wersji: tydzień czy cykl.

## Etap 3 – ujednolicenie dokumentacji

1. Nadać stabilne `ruleId`.
2. Przyjąć słownik pojęć.
3. Ujednolicić enumy statusów i polsko-angielskie mapowanie.
4. Określić źródła prawdy relacji oraz pól pochodnych modelu.
5. Oznaczyć funkcje przyszłe: ręczna edycja, stabilność, wiele grup, import/eksport.
6. Ujednolicić wielkość liter nazwy `Specyfikacja.md`.
7. Uzupełnić wykonywalne dane i jednoznaczne wyniki testów.

## Etap 4 – weryfikacja prawna

1. Ustalić właściwy reżim prawny i zakres podmiotowy.
2. Zweryfikować odpoczynek dobowy i tygodniowy oraz wyjątki.
3. Zweryfikować maksymalną pracę dobową i długość odcinka.
4. Zweryfikować pięciodniowy tydzień, weekendy i placówkę siedmiodniową.
5. Zweryfikować godziny ponadwymiarowe i rozliczanie tygodni specjalnych.
6. Zapisać źródła, okres obowiązywania i zatwierdzenie w wersji konfiguracji prawnej.

## Etap 5 – gotowość do implementacji

Przed wydaniem polecenia rozpoczęcia kodowania powinny być spełnione wszystkie warunki:

* zero nierozstrzygniętych problemów krytycznych,
* zatwierdzona klasyfikacja każdej reguły,
* jednoznaczny model wyjątków i zapotrzebowania,
* zatwierdzona konfiguracja prawna albo formalnie określony tryb demonstracyjny,
* spójny model statusów i relacji,
* wykonywalne testy dla każdej reguły krytycznej,
* test granicy tygodni i zawinięcia cyklu,
* zdefiniowana niezależność walidatora,
* zatwierdzona macierz śledzenia wymagań.

---

# XXV. KOŃCOWA LISTA KONTROLNA

| Nr | Pytanie | Odpowiedź | Uzasadnienie |
|---:|---|---|---|
| 1 | Czy zakres pierwszej wersji jest jednoznaczny? | `CZĘŚCIOWO` | Jedna grupa i trzy osoby są jasne; cykl kontra tydzień oraz JSON/manual nie. |
| 2 | Czy wszystkie reguły krytyczne są spójne? | `NIE` | Sprzeczne są godziny opieki, krok, priorytety, dni i część weekendów. |
| 3 | Czy generator może zostać zaimplementowany bez zgadywania? | `NIE` | Musiałby wybrać semantykę wyjątków, granic cyklu i źródeł konfiguracji. |
| 4 | Czy walidator może działać niezależnie? | `CZĘŚCIOWO` | Jest osobnym modułem, ale może ufać wspólnemu obliczonemu popytowi. |
| 5 | Czy model danych zawiera wszystkie wymagane informacje? | `NIE` | Brakuje m.in. semantyki merge, kontekstu cyklu, źródeł prawnych i części statusów. |
| 6 | Czy dni specjalne są obsługiwane jednoznacznie? | `NIE` | Typy i hierarchia istnieją, lecz nie operacja zastąpienia/dodania/usunięcia. |
| 7 | Czy zmienne godziny szkoły są obsługiwane jednoznacznie? | `CZĘŚCIOWO` | Późniejsze dokumenty tak, lecz `ZASADY.md` i `WALIDACJA.md` zachowują stały schemat. |
| 8 | Czy sześciotygodniowa rotacja weekendowa jest poprawna? | `TAK` | Podana kolejność par, wolnych weekendów i odwrócenia ról jest matematycznie poprawna; priorytet reguły nadal wymaga decyzji. |
| 9 | Czy liczba dni pracy jest jednoznacznie zdefiniowana? | `CZĘŚCIOWO` | Definicja dnia jest jasna, ale istnieją dwa pola konfiguracji i stała „5”. |
| 10 | Czy zmienne zapotrzebowanie jest zgodne ze stałymi przydziałami godzin? | `NIE` | Obecnie każda różnica blokuje cykl; brak decyzji o modelu rozliczenia. |
| 11 | Czy wszystkie reguły posiadają testy? | `NIE` | Brakuje m.in. pracy poza popytem, multi-staff, wrap-around i dokładnych komunikatów. |
| 12 | Czy wszystkie wartości prawne zostały zweryfikowane? | `NIE` | Dokumenty jawnie określają 11 i 35 godzin jako robocze. |
| 13 | Czy dokumentacja jest gotowa do implementacji? | `NIE` | Pozostaje 8 problemów krytycznych i 13 wysokich. |

---

# XXVI. ZASADY KOŃCOWE

Raport:

* nie zmienia żadnego z analizowanych dokumentów,
* nie tworzy kodu,
* nie instaluje bibliotek,
* nie wybiera technologii,
* nie rozstrzyga prawa,
* nie przyjmuje ukrytych wartości domyślnych,
* nie traktuje przykładów jako reguł,
* przedstawia warianty wyłącznie jako opcje do decyzji użytkownika.

**Końcowa ocena: `NIEGOTOWA DO IMPLEMENTACJI`.**

Warunkiem przejścia do projektowania kodu jest przede wszystkim rozstrzygnięcie problemów `P-001`–`P-008`, a następnie ujednolicenie priorytetów, statusów, identyfikatorów reguł, relacji modelu oraz konfiguracji prawnej.
