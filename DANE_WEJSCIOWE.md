# DANE WEJŚCIOWE

## 1. Cel dokumentu

Dokument określa kompletny zestaw danych wymaganych przed wygenerowaniem powtarzalnego sześciotygodniowego cyklu dla jednej grupy i dokładnie trzech wychowawców.

Generator korzysta wyłącznie z wersji konfiguracji o statusie wejścia `VALID_INPUT`. Braki lub sprzeczności powodują `INVALID_INPUT` i publiczny wynik `DANE_NIEPOPRAWNE`.

## 2. Zakres pierwszej wersji

Dane pierwszej wersji opisują:

* jedną grupę,
* dokładnie trzech wychowawców,
* sześć kolejnych tygodni,
* cykl powtarzalny,
* początek cyklu w poniedziałek,
* jawną strefę IANA `Europe/Warsaw`,
* kontrolę przejścia tydzień 6 → tydzień 1,
* jeden krok czasowy równy 30 minut,
* globalne minimum odcinka równe 120 minut,
* globalnie pięć dni pracy na wychowawcę w każdym tygodniu,
* dokładnie jedną osobę w każdym wymaganym slocie.

Nie przewiduje się wychowawcy rezerwowego, puli międzygrupowej ani podwójnej obsady.

Pierwsza wersja nie przyjmuje danych do ręcznej edycji, blokowania zmian, importu/eksportu JSON, wielu grup ani porównania z poprzednim harmonogramem.

---

# I. KONFIGURACJA CYKLU I GRUPY

## 1. Wersja konfiguracji

Wymagane dane:

* identyfikator wersji,
* numer wersji,
* data rozpoczęcia cyklu,
* `weekStartDay = MONDAY`,
* jawne `timeZoneId`,
* `cycleLengthWeeks = 6`,
* `cycleIsRepeating = true`,
* pozycja początkowa rotacji weekendowej,
* status walidacji wejścia (`DERIVED`).

`cycleStartDate` musi przypadać w poniedziałek. Wstępnie wybraną i widoczną wartością `timeZoneId` jest `Europe/Warsaw`; użytkownik zatwierdza ją jawnie. Brak strefy oraz nieistniejąca albo niejednoznaczna lokalna granica czasu powodują `INVALID_INPUT`.

Inne wartości długości cyklu, powtarzalności albo początku tygodnia są niepoprawne w pierwszej wersji. Autorytatywne `timeStepMinutes` należy do dokładnie jednej `OrganizationalRulesConfiguration`.

Konfiguracja prawna i konfiguracja organizacyjna wskazują tę wersję przez własne `configurationVersionId`. Wersja konfiguracji nie przechowuje tablic ani niezależnych identyfikatorów swoich encji podrzędnych.

## 2. Grupa

Wymagane dane:

* `id`,
* identyfikator wersji konfiguracji,
* nazwa wyświetlana,
* skrót,
* status aktywności.

Dane wpływające na zapotrzebowanie zawsze zawierają `groupId`.

---

# II. WYCHOWAWCY I GODZINY

## 1. Wychowawca

Dla każdego z dokładnie trzech wychowawców wymagane są:

* niezmienny `id`,
* `groupId`,
* nazwa wyświetlana,
* kod skrócony,
* podstawowy tygodniowy przydział minut,
* status aktywności.

Pierwsza wersja nie przechowuje osobnego `requiredWorkDaysPerWeek` przy wychowawcy. Liczba dni pochodzi wyłącznie z globalnej konfiguracji organizacyjnej.

Pole `canWorkWeekends` nie jest wymagane. Jeżeli pozostaje technicznie w danych, musi mieć wartość `true` dla wszystkich trzech osób.

## 2. Podstawowy przydział godzin

Podstawowy przydział jest podawany w minutach i obowiązuje w każdym tygodniu, o ile nie istnieje zatwierdzony przydział zastępczy.

Przykłady demonstracyjne:

* 24 godziny = 1440 minut,
* 27,5 godziny = 1650 minut.

## 3. Przydział zastępczy dla tygodnia

Opcjonalny wpis zawiera:

* `id`,
* `educatorId`,
* `configurationVersionId`,
* numer tygodnia od 1 do 6,
* zatwierdzoną liczbę minut,
* opis przyczyny,
* datę zatwierdzenia,
* osobę albo rolę zatwierdzającą.

Wpis w całości zastępuje podstawowy przydział danego wychowawcy w konkretnym tygodniu.

Generator:

* nie tworzy wpisu,
* nie proponuje liczby minut,
* nie przenosi godzin z innego tygodnia.

## 4. Bilans tygodnia

Dla każdego tygodnia suma obowiązujących przydziałów musi dokładnie odpowiadać rzeczywistemu zapotrzebowaniu.

Brak równości powoduje:

* status `INVALID_INPUT`,
* publiczny komunikat `DANE_NIEPOPRAWNE`,
* brak uruchomienia solvera,
* raport zawierający tydzień, daty, popyt, przydziały, różnicę i zdarzenia wpływające na popyt.

---

# III. KOMPLETNE PLANY DNIA

## 1. Wspólny model planu

Każdy plan dnia zawiera:

* `id`,
* identyfikator wersji konfiguracji,
* `groupId`,
* zakres planu,
* dzień tygodnia,
* opcjonalny numer tygodnia,
* opcjonalną datę,
* pełną listę godzin funkcjonowania internatu,
* pełną listę przedziałów, w których opieka internatu nie jest wymagana,
* opcjonalny `eventType` dnia specjalnego z kontrolowanej listy,
* opcjonalny `customEventType`, wymagany dla `CUSTOM`,
* opis,
* status zatwierdzenia.

Dozwolone zakresy:

* `BASE_WEEKLY` – podstawowy profil dnia tygodnia,
* `CYCLE_WEEK` – kompletny plan dnia konkretnego tygodnia,
* `SPECIFIC_DATE` – kompletny plan konkretnej daty.

Warunki:

* `BASE_WEEKLY` wymaga `dayOfWeek`,
* `CYCLE_WEEK` wymaga `weekNumber` i `dayOfWeek`,
* `SPECIFIC_DATE` wymaga `date`,
* każdy plan musi być kompletny i zatwierdzony.

Klucze unikalności zatwierdzonych planów:

| Zakres | Klucz |
|---|---|
| `BASE_WEEKLY` | `configurationVersionId`, `groupId`, `scope`, `dayOfWeek` |
| `CYCLE_WEEK` | `configurationVersionId`, `groupId`, `scope`, `weekNumber`, `dayOfWeek` |
| `SPECIFIC_DATE` | `configurationVersionId`, `groupId`, `scope`, `date` |

Dla każdego dnia tygodnia istnieje dokładnie jeden zatwierdzony `BASE_WEEKLY`. Na pozostałych poziomach może istnieć zero albo jeden zatwierdzony plan danego klucza. Duplikat powoduje `INVALID_INPUT`.

## 2. Hierarchia

Dla konkretnej daty aplikacja wybiera:

1. `SPECIFIC_DATE`,
2. `CYCLE_WEEK`,
3. `BASE_WEEKLY`,
4. brak danych.

Brak kompletnego planu powoduje `INVALID_INPUT`.

Dla każdej z 42 dat musi istnieć dokładnie jeden skuteczny plan. Moduły nie wybierają rekordów według kolejności technicznej.

Plan wybranego poziomu zastępuje cały plan niższego poziomu. Nie stosuje się częściowych operacji dodawania ani usuwania.

## 3. Wyjątek konkretnej daty

Wyjątek jest kompletnym planem `SPECIFIC_DATE`.

Zawiera:

* pełne godziny funkcjonowania internatu,
* wszystkie przedziały bez wymaganej opieki,
* typ i opis dnia specjalnego.

Jeżeli użytkownik zmienia jeden element, interfejs może skopiować plan niższego poziomu do formularza, ale zapisuje kompletny nowy plan dnia.

---

# IV. GODZINY FUNKCJONOWANIA I BRAK WYMAGANEJ OPIEKI

## 1. Godziny funkcjonowania internatu

Każdy przedział zawiera:

* `id`,
* `dayPlanId`,
* `groupId`,
* `startTime`,
* `endTime`,
* opis.

Przedział:

* jest półotwarty `[początek, koniec)`,
* zaczyna się i kończy tej samej daty,
* ma granice zgodne z krokiem 30 minut,
* ma dodatnią długość,
* nie przechodzi przez północ.

Pełna lista godzin funkcjonowania jest traktowana jako zbiór czasu. Przedziały nakładające się i stykające są sortowane i scalane do rozłącznej listy kanonicznej.

## 2. Przedział bez wymaganej opieki

Każdy przedział zawiera:

* `id`,
* `dayPlanId`,
* `groupId`,
* `startTime`,
* `endTime`,
* `eventType`,
* opcjonalne `customEventType`,
* `description`.

Kontrolowane typy:

* `SCHOOL`,
* `INTERNSHIP`,
* `TRIP`,
* `CEREMONY`,
* `ACTIVITY_OUTSIDE`,
* `OTHER_CARE`,
* `CUSTOM`.

`customEventType` jest wymagane wyłącznie dla `CUSTOM`.

Przedział musi w całości mieścić się w sumie godzin funkcjonowania internatu, inaczej dane są `INVALID_INPUT`.

Pełna lista przedziałów bez opieki jest traktowana jako zbiór czasu. Przedziały nakładające się i stykające są sortowane i scalane do rozłącznej listy kanonicznej. Metadane rekordów źródłowych są zachowane.

## 3. Dynamiczne obliczenie zapotrzebowania

Dla każdej daty:

1. wybiera się kompletny plan,
2. oblicza `union(operatingIntervals)`,
3. oblicza `union(noCareIntervals)`,
4. wyznacza `union(operatingIntervals) \ union(noCareIntervals)`,
5. zapisuje wynik jako przedziały wymaganej opieki,
6. wyprowadza `requiredStaffCount = 1`,
7. oblicza sumę minut.

`requiredStaffCount` jest `DERIVED` i nie należy do danych użytkownika. Jeżeli kalkulator wytworzy wartość inną niż `1`, wynik modułu to `INTERNAL_ERROR`, publicznie `BLAD_WEWNETRZNY`, z głównym `REQ-VALIDATOR-INDEP-001` i kontekstem `REQ-STAFFING-001`.

Nie istnieją stałe systemowe określające godziny szkoły, opieki ani tygodniową sumę popytu.

---

# V. NIEDOSTĘPNOŚCI

## 1. Dane wpisu

Wpis zawiera:

* `id`,
* `educatorId`,
* `scope`,
* `date`,
* `weekNumber`,
* `dayOfWeek`,
* `startTime`,
* `endTime`,
* `type`,
* opis.

Zakresy:

* `RECURRING_WEEKLY`,
* `CYCLE_WEEK`,
* `SPECIFIC_DATE`.

Typy:

* `HARD`,
* `PREFERRED`.

## 2. Łączenie wpisów

Wszystkie obowiązujące wpisy są sumowane.

* wpisy różnych zakresów nie zastępują się,
* wpisy tego samego typu są scalane,
* `HARD` dominuje nad `PREFERRED`,
* brak wpisu oznacza możliwość przydziału, nie gwarancję przydziału.

Każdy przedział niedostępności jest półotwarty, zgodny z krokiem 30 minut, dodatni i nie przechodzi przez północ.

---

# VI. KONFIGURACJA ORGANIZACYJNA

Pierwsza wersja wymaga:

* `timeStepMinutes = 30`,
* `minimumSegmentMinutes = 120`,
* `requiredWorkDaysPerWeek = 5`,
* włączonej sześciotygodniowej rotacji,
* braku podwójnej obsady,
* jawnych wag mierzalnych preferencji.

`OrganizationalRulesConfiguration.timeStepMinutes` jest jedynym źródłem kroku czasowego; `ScheduleConfigurationVersion` nie duplikuje tego pola.

Wagi obejmują:

* przekazanie popołudnia,
* nierówny podział weekendu,
* dni dzielone,
* odcinki ponad preferowane 8 godzin,
* niedostępność `PREFERRED`.

Wagi są jawnymi, nieujemnymi liczbami całkowitymi zatwierdzonej konfiguracji.

Składniki funkcji celu:

* `P_afternoon = Σ |handoverMinute - preferredAfternoonHandoverMinute| / timeStepMinutes`,
* `P_weekend = Σ |assignedMinutes - preferredWeekendSplitMinutes| / timeStepMinutes`,
* `P_splitDays = Σ max(0, segmentCount(educator, date) - 1)`,
* `P_longSegments = Σ max(0, durationMinutes - preferredMaximumSegmentMinutes) / timeStepMinutes`,
* `P_preferredUnavailable` – liczba przypisanych slotów przecinających znormalizowane `PREFERRED`.

`objectiveScore = wA × P_afternoon + wW × P_weekend + wS × P_splitDays + wL × P_longSegments + wU × P_preferredUnavailable`.

`P_afternoon` dotyczy przekazań w roboczym ciągłym przedziale zawierającym godzinę preferowaną; brak takiego popytu albo brak podziału daje `0`. `P_weekend` jest sumowane osobno dla obu osób i obu dni. `P_preferredUnavailable` jest liczone po normalizacji i dominacji `HARD`.

Kara weekendowa nie pozwala zmieniać zatwierdzonego wzorca. Remis rozstrzyga mniejszy wektor pięciu kar, a następnie leksykograficznie mniejsza kanoniczna lista `(date, startTime, endTime, educatorId)`.

Pierwsza wersja nie przyjmuje wag prostoty, czytelności, regularności ani stabilności względem poprzedniego harmonogramu.

---

# VII. KONFIGURACJA PRAWNA

Wymagane pola:

* `jurisdiction`,
* `sourceTitle`,
* `sourceSection`,
* `sourceIdentifier`,
* `verifiedAt`,
* `effectiveFrom`,
* `effectiveTo`,
* `approvedBy`,
* `version`,
* `verificationNotes`,
* `verificationStatus`,
* `minimumDailyRestMinutes`,
* `weeklyRestWindowType`,
* `weeklyRestWindowLengthMinutes`,
* `weeklyRestWindowStepMinutes`,
* `weeklyRestAnchorDayOfWeek`,
* `weeklyRestAnchorTime`,
* `minimumWeeklyRestMinutes`,
* `weeklyRestAttributionMode`,
* `weeklyRestReuseAcrossWindowsAllowed`,
* `weeklyRestExceptionEnabled`,
* `weeklyRestExceptionMinimumMinutes`,
* `weeklyRestExceptionMaximumOccurrencesPerCycle`,
* `weeklyRestExceptionMinimumGapMinutes`,
* `weeklyRestCompensationRequired`,
* `weeklyRestCompensationMinutes`,
* `weeklyRestCompensationDeadlineMinutes`,
* opcjonalny prawnie zatwierdzony limit bezwzględny.

`weeklyRestWindowType` przyjmuje `FIXED_LOCAL_WEEK` albo `ROLLING_DURATION`. `weeklyRestAttributionMode` przyjmuje `FULLY_CONTAINED` albo `INTERSECTION_WITH_WINDOW`.

Pola nieużywane przez wybrany typ albo wyłączony wyjątek są jawnie puste. W profilu `VERIFIED` cała metoda i każda używana wartość należą do śladu prawnego.

Żądanie generowania wskazuje jawnie `requestedOperationMode`:

* `PRODUCTION`,
* `DEMONSTRATION`.

Pola `verifiedAt` i `approvedBy` są obowiązkowe dla statusu `VERIFIED`. W profilu `UNVERIFIED` nie mogą pozorować przeprowadzonego zatwierdzenia.

Statusy:

* `UNVERIFIED`,
* `VERIFIED`,
* `EXPIRED`.

| Profil | Tryb | Solver | Poprawny wynik |
|---|---|---:|---|
| `VERIFIED` | `PRODUCTION` | startuje | `POPRAWNY` |
| `VERIFIED` | `DEMONSTRATION` | startuje | `POPRAWNY_TRYB_DEMONSTRACYJNY` |
| `UNVERIFIED` | `PRODUCTION` | nie startuje | `DANE_NIEPOPRAWNE` |
| `UNVERIFIED` | `DEMONSTRATION` | startuje | `POPRAWNY_TRYB_DEMONSTRACYJNY` |
| `EXPIRED` | `PRODUCTION` | nie startuje | `DANE_NIEPOPRAWNE` |
| `EXPIRED` | `DEMONSTRATION` | startuje | `POPRAWNY_TRYB_DEMONSTRACYJNY` |

Wynik demonstracyjny pokazuje brak dopuszczenia do rzeczywistego użycia, status i wersję profilu oraz datę weryfikacji albo wygaśnięcia.

Wartości 11 i 35 godzin są robocze i nie mogą być oznaczone jako prawnie zatwierdzone bez zewnętrznej weryfikacji.

---

# VIII. DOKŁADNE WZORCE WEEKENDOWE

## 1. Wariant bazowy

Dla wersji wymaganych jest dokładnie sześć zatwierdzonych wariantów `BASE` o pozycjach 1–6. Każdy wariant zawiera:

* identyfikator i `configurationVersionId`,
* `variantKind = BASE`,
* `positionInCycle`,
* `offEducatorId`,
* zatwierdzenie i jego referencję,
* dokładnie jeden szablon `SATURDAY`,
* dokładnie jeden szablon `SUNDAY`,
* uporządkowane odcinki z `educatorId`, `startTime`, `endTime` i `sequenceNumber`.

Zbiór pracujących jest wyprowadzany z odcinków i zawiera dokładnie dwóch wychowawców. Razem z `offEducatorId` tworzy dokładnie trzech aktywnych wychowawców grupy.

Zatwierdzony bazowy popyt placówki wynosi w sobotę i niedzielę `[06:00,22:00)`. Godziny poszczególnych odcinków i ich kolejność są kopiowane 1:1 z zatwierdzonego wzorca, bez domyślania jednej godziny przekazania lub kolejności osób.

## 2. Wariant zastępczy

Jeżeli kompletny `SPECIFIC_DATE` zmienia weekendowy popyt i wariant bazowy przestaje pasować dokładnie, wymagany jest jeden zatwierdzony `SUBSTITUTE` z:

* `replacesWeekendRotationVariantId`,
* numerem tygodnia,
* datą soboty i niedzieli,
* pełnymi szablonami obu dni,
* zatwierdzeniem i referencją.

Brak, duplikat albo niezatwierdzony wymagany `SUBSTITUTE` powoduje `INVALID_INPUT`. Generator go nie tworzy i nie zmienia pozycji rotacji bazowej.

Pola `workingEducatorIds`, `saturdayTemplateId`, `sundayTemplateId`, `assignmentTemplateIds`, `handoverCount` i `totalTemplateMinutes` są wyłącznie `DERIVED`, jeżeli są materializowane.

---

# IX. WALIDACJA DANYCH WEJŚCIOWYCH

Walidacja przed solverem sprawdza co najmniej:

1. dokładnie jedną grupę i dokładnie trzech aktywnych wychowawców,
2. brak wychowawcy rezerwowego i puli międzygrupowej,
3. sześć tygodni i `cycleIsRepeating = true`,
4. poniedziałkowy `cycleStartDate` i `weekStartDay = MONDAY`,
5. jawne `timeZoneId` i poprawne lokalne granice czasu,
6. krok 30 minut,
7. minimum 120 minut,
8. pięć dni pracy w konfiguracji globalnej,
9. dopuszczenie całej trójki do weekendów,
10. unikalność zatwierdzonych planów i dokładnie jeden skuteczny plan każdej daty,
11. brak częściowych wyjątków,
12. normalizację przedziałów i zawieranie okresów bez opieki w godzinach funkcjonowania,
13. poprawność przedziałów i zakaz przejścia przez północ,
14. brak `requiredStaffCount` w surowym wejściu,
15. poprawność i scalanie niedostępności,
16. obowiązujący przydział minut dla każdej osoby i tygodnia,
17. równość sumy przydziałów z popytem każdego tygodnia,
18. sześć zatwierdzonych dokładnych wariantów weekendowych albo wymagany `SUBSTITUTE`,
19. dokładnie jedną konfigurację organizacyjną i jeden wybrany profil prawny dla wersji,
20. spójność wszystkich referencji wersji i grupy,
21. status konfiguracji prawnej i dozwolony tryb działania,
22. brak ukrytych wartości domyślnych.

Wykrycie błędu nie uruchamia solvera.

---

# X. STATUSY

## Walidacja wejścia

* `NOT_VALIDATED`,
* `VALID_INPUT`,
* `INVALID_INPUT`.

## Publiczny wynik błędu wejścia

`DANE_NIEPOPRAWNE`

---

# XI. PRZYKŁAD DEMONSTRACYJNY

Poniższe wartości służą wyłącznie demonstracji:

* godziny funkcjonowania: `06:00–22:00`,
* pobyt poza internatem: `08:00–14:30`,
* wynikowa opieka: `06:00–08:00` i `14:30–22:00`.

Jeżeli w konkretnej dacie pobyt poza internatem wynosi `08:00–12:00`, wynik dla tego samego demonstracyjnego przedziału funkcjonowania wynosi `06:00–08:00` i `12:00–22:00`.

Żadna z tych godzin ani suma `79,5 godziny` nie jest wartością domyślną.

Zapis ten nie zmienia zatwierdzonego rzeczywistego weekendowego popytu `[06:00,22:00)` w sobotę i niedzielę.

---

# XII. REJESTR IDENTYFIKATORÓW REGUŁ

Reguły krytyczne używane przez walidację wejścia:

* `REQ-NO-GUESSING-001`,
* `REQ-SPECIAL-DAY-001`,
* `REQ-TIME-STEP-001`,
* `REQ-TIME-SAME-DAY-001`,
* `REQ-SEGMENT-MIN-001`,
* `REQ-COVERAGE-001`,
* `REQ-STAFFING-001`,
* `REQ-NO-OUTSIDE-001`,
* `REQ-HOURS-001`,
* `REQ-DAYS-001`,
* `REQ-UNAVAILABLE-HARD-001`,
* `REQ-REST-DAILY-001`,
* `REQ-REST-WEEKLY-001`,
* `REQ-WEEKEND-001`,
* `REQ-ROTATION-001`,
* `REQ-CROSS-WEEK-001`,
* `REQ-VALIDATOR-INDEP-001`,
* `REQ-LEGAL-001`.

Preferencje:

* `REQ-PREF-AFTERNOON-001`,
* `REQ-PREF-WEEKEND-SPLIT-001`,
* `REQ-PREF-SPLIT-DAYS-001`,
* `REQ-PREF-LONG-SEGMENT-001`,
* `REQ-PREF-UNAVAILABLE-001`.
