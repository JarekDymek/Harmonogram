# TESTY I SCENARIUSZE

## I. Cel i zasady wykonywania testów

Dokument definiuje wykonywalne przypadki testowe dla wejścia, kalkulatorów, niezależnego walidatora reguł, generatora i pełnego przebiegu systemu. Dane prawne i godziny oznaczone jako testowe nie stanowią konfiguracji produkcyjnej placówki.

Każdy test ma jawne pole `testLevel` o jednej z wartości:

| `testLevel` | Testowany kontrakt | Dozwolone statusy |
|---|---|---|
| `INPUT_VALIDATION` | kompletność i spójność danych przed uruchomieniem solvera | `VALID_INPUT`, `INVALID_INPUT` |
| `CALCULATOR_UNIT` | kalkulator popytu, normalizacja, czas i pola `DERIVED` | `CALCULATION_OK`, `INTERNAL_ERROR` |
| `RULE_VALIDATOR_UNIT` | pojedyncza reguła niezależnego walidatora | `RULE_SATISFIED`, `RULE_VIOLATED` |
| `SOLVER_INTEGRATION` | generator, status uruchomienia i niezależna walidacja kandydata | `CANDIDATE_FOUND`, `NO_SOLUTION`, `TIME_LIMIT`, `INTERNAL_ERROR` |
| `END_TO_END` | pełny `GenerationRun` wraz z `ValidationReport` i statusem publicznym | `VALID` albo `INVALID` w raporcie; odpowiedni status publiczny |

Statusów `VALID` i `INVALID` wolno używać wyłącznie w testach `END_TO_END`, które sprawdzają kompletny `ValidationReport`. Na pozostałych poziomach obowiązują wyłącznie statusy z powyższej tabeli.

Każdy przypadek wskazuje kompletny fixture. Zapis „kopia fixture; zmiana …” oznacza utworzenie pełnej, niezależnej kopii wszystkich encji fixture i zastąpienie wyłącznie wymienionych pól. Żadne pole nie jest domyślne ani dopowiadane. Dane oczekiwane muszą być utrzymywane niezależnie od kodu generatora.

---

## II. Kompletne fixtures

### `FIX-INPUT-VALID`

Kompletne, syntetyczne wejście bazowe:

- projekt `P-TEST-01` ma nazwę `TEST`, status `CONFIGURED` i jawną wersję dziecka `CV-TEST-01`;
- `configurationVersionId = CV-TEST-01`, `groupId = G1`;
- wersja ma `versionNumber = 1`, jawne testowe `createdAt`, `createdBy`, `cycleLengthWeeks = 6`, `cycleIsRepeating = true` i `startingWeekendVariant = 1`;
- grupa `G1` ma `displayName = Grupa testowa`, `shortName = G1`, jest aktywna i należy do `CV-TEST-01`;
- dokładnie trzech wychowawców: `A`, `B`, `C`, każdy ma jawne `displayName`, `shortCode`, `baseWeeklyAssignedMinutes = 840`, jest aktywny i należy do `G1`; brak wychowawcy rezerwowego i puli międzygrupowej;
- zakres `2026-09-14`–`2026-10-25`, czyli dokładnie 42 kolejne daty;
- `cycleStartDate = 2026-09-14`, `weekStartDay = MONDAY`, `timeZoneId = Europe/Warsaw`;
- `timeStepMinutes = 30`, `minimumSegmentMinutes = 120`, `requiredWorkDaysPerWeek = 5`, `startingWeekendVariant = 1`;
- dla każdego dnia istnieje dokładnie jeden zatwierdzony `BASE_WEEKLY` właściwy dla dnia tygodnia; nie ma planów `CYCLE_WEEK` ani `SPECIFIC_DATE`;
- każdy plan bazowy ma `operatingIntervals = {[06:00,12:00)}` i pusty zbiór `noCareIntervals`, dlatego popyt każdej daty wynosi dokładnie `[06:00,12:00)`, 360 minut i jedną osobę w każdym slocie;
- zatwierdzone przydziały godzin w każdym tygodniu: A = 840 minut, B = 840 minut, C = 840 minut; suma = 2520 minut popytu;
- brak niedostępności `HARD` i `PREFERRED`;
- dokładnie jedna konfiguracja organizacyjna `OR-TEST-01` ma pięć całkowitych, nieujemnych wag równych 1; `preferredAfternoonHandoverTime = 17:00`, `preferredWeekendSplitMinutes = 480`, `preferredMaximumSegmentMinutes = 480`;
- dokładnie jeden profil `LP-TEST-01` ma `jurisdiction = TEST`, testowe `sourceTitle`, `sourceSection`, `sourceIdentifier`, `version = 1`, `verificationNotes`, zakres `effectiveFrom`–`effectiveTo` obejmujący fixture i `verificationStatus = UNVERIFIED`; `verifiedAt` i `approvedBy` są jawnie puste;
- `requestedOperationMode = DEMONSTRATION`;
- testowe `minimumDailyRestMinutes = 660`, `minimumWeeklyRestMinutes = 2100`;
- `weeklyRestWindowType = FIXED_LOCAL_WEEK`, testowe `weeklyRestWindowLengthMinutes = 10080`, `weeklyRestWindowStepMinutes = 10080`, kotwica poniedziałek `00:00`, `weeklyRestAttributionMode = INTERSECTION_WITH_WINDOW`, `weeklyRestReuseAcrossWindowsAllowed = false`;
- `weeklyRestExceptionEnabled = false`; `weeklyRestExceptionMinimumMinutes`, `weeklyRestExceptionMaximumOccurrencesPerCycle` i `weeklyRestExceptionMinimumGapMinutes` są jawnie puste;
- `weeklyRestCompensationRequired = false`; `weeklyRestCompensationMinutes` i `weeklyRestCompensationDeadlineMinutes` są jawnie puste;
- wszystkie encje posiadające `configurationVersionId` wskazują `CV-TEST-01`, encje posiadające `groupId` wskazują `G1`, a referencje do wychowawców wskazują wyłącznie A, B albo C.

Fixture jest wejściowo poprawny wyłącznie w trybie demonstracyjnym.

### `FIX-DAY-DEMO`

Kompletna kopia `FIX-INPUT-VALID` ograniczona do testu kalkulatora jednej daty, z pełnym skutecznym planem:

- data `2026-09-14`;
- `operatingIntervals = {[06:00,22:00)}`;
- `noCareIntervals = {[08:00,14:30)}`;
- oczekiwany znormalizowany popyt: `{[06:00,08:00), [14:30,22:00)}`;
- oczekiwany czas popytu: 570 minut.

### `FIX-NORMALIZATION`

Kompletna kopia `FIX-DAY-DEMO`, w której:

- `operatingIntervals = {[06:00,10:00), [08:00,12:00), [12:00,14:00)}`;
- `noCareIntervals = {[07:00,08:30), [08:00,09:00), [13:00,14:00)}`;
- oczekiwana suma zbioru działania: `{[06:00,14:00)}`;
- oczekiwana suma zbioru braku opieki: `{[07:00,09:00), [13:00,14:00)}`;
- oczekiwany popyt: `{[06:00,07:00), [09:00,13:00)}`, 300 minut.

### `FIX-V2-WEEKEND-APPROVED`

Kompletne wejście komponentowe dla weekendowego walidatora reguł:

- `configurationVersionId = CV-TEST-01`, `groupId = G1`, wychowawcy A, B, C;
- `cycleStartDate = 2026-09-14`, `weekStartDay = MONDAY`, `timeZoneId = Europe/Warsaw`;
- `timeStepMinutes = 30`, `minimumSegmentMinutes = 120`, `startingWeekendVariant = 1`;
- profil `LP-TEST-01`, `UNVERIFIED`, tryb `DEMONSTRATION`, odpoczynek dobowy 660 minut i tygodniowy 2100 minut;
- pełna testowa struktura odpoczynku jest identyczna z `FIX-INPUT-VALID`: okno `FIXED_LOCAL_WEEK` długości i kroku 10080 minut, poniedziałek `00:00`, przypisanie `INTERSECTION_WITH_WINDOW`, brak ponownego użycia, wyjątki i kompensacje wyłączone, a pola nieużywane jawnie puste;
- popyt każdej testowanej soboty i niedzieli wynosi dokładnie `[06:00,22:00)`, z dokładnie jedną wymaganą osobą w każdym slocie;
- brak niedostępności;
- sześć zatwierdzonych wariantów `BASE`:

| Pozycja | Pierwsza osoba | Druga osoba | Wolny |
|---:|---|---|---|
| 1 | A | B | C |
| 2 | A | C | B |
| 3 | B | C | A |
| 4 | B | A | C |
| 5 | C | A | B |
| 6 | C | B | A |

Dla soboty i niedzieli każdego wariantu zatwierdzony szablon zawiera dokładnie dwie krotki:

1. pierwsza osoba `[06:00,14:00)`, `sequenceNumber = 1`;
2. druga osoba `[14:00,22:00)`, `sequenceNumber = 2`.

Każdy dzień ma `handoverCount = 1`; wariant ma `approved = true`, `approvalReference = TEST-APPROVAL`, `approvedAt = 2026-09-01T10:00:00+02:00` i `approvedBy = TEST`. Symbole kolejności są wyłącznie opisem fixture. Walidator porównuje `educatorId`, datę, początek, koniec i `sequenceNumber`. Godziny tego fixture są testowe; produkcyjny wzorzec placówki musi być zapisany 1:1 w zatwierdzonej konfiguracji.

### `FIX-V2-CYCLE-INTEGRATION`

Kompletny fixture integracyjny jest pełną kopią `FIX-INPUT-VALID` z następującymi jawnymi uzupełnieniami:

- zawiera sześć wariantów `BASE` w kolejności par z `FIX-V2-WEEKEND-APPROVED`;
- dla soboty każdego wariantu pierwsza osoba ma `[06:00,09:00)`, druga `[09:00,12:00)`;
- dla niedzieli obowiązują identyczne dwa szablony;
- `sequenceNumber = 1, 2`, `handoverCount = 1`;
- brak wariantów `SUBSTITUTE`;
- wszystkie 42 daty mają jawne skuteczne plany i następujący szablon przydziałów w każdym tygodniu, gdzie M, P i O rozwija się według identyfikatorów wariantu:

| Dzień | Dokładne przedziały osób wskazanych przez wariant |
|---|---|
| poniedziałek | P `[06:00,09:00)`, O `[09:00,12:00)` |
| wtorek | P `[06:00,09:00)`, O `[09:00,12:00)` |
| środa | M `[06:00,08:00)`, P `[08:00,10:00)`, O `[10:00,12:00)` |
| czwartek | M `[06:00,09:00)`, O `[09:00,12:00)` |
| piątek | M `[06:00,09:00)`, O `[09:00,12:00)` |
| sobota | M `[06:00,09:00)`, P `[09:00,12:00)` |
| niedziela | M `[06:00,09:00)`, P `[09:00,12:00)` |

W każdym tygodniu każda osoba pracuje 840 minut w dokładnie pięciu datach. Każdy odcinek ma co najmniej 120 minut, każdy wymagany slot ma dokładnie jedną osobę, odpoczynki są spełnione także na granicy tygodnia 6 → 1. Fixture zawiera jawny harmonogram kolejnego tygodnia 1 potrzebny do sprawdzenia granicy cyklu.

Godziny `[06:00,09:00)` i `[09:00,12:00)` są wyłącznie danymi syntetycznego fixture integracyjnego. Nie zastępują rzeczywistego, zatwierdzonego bazowego popytu placówki `[06:00,22:00)` ani jego produkcyjnych szablonów.

### `FIX-E2E-VERIFIED`

Kompletna kopia `FIX-V2-CYCLE-INTEGRATION`, w której profil:

- ma `verificationStatus = VERIFIED`;
- ma niepuste `jurisdiction`, `sourceTitle`, `sourceSection`, `sourceIdentifier`, `verifiedAt`, `approvedBy`, `version` i `verificationNotes`;
- ma zakres obowiązywania obejmujący cały cykl;
- ma `requestedOperationMode = PRODUCTION`;
- nie jest zastąpiony inną wersją.

Fixture zawiera pełny oczekiwany `ValidationReport`: `status = VALID`, zero naruszeń, wszystkie reguły krytyczne oznaczone jako spełnione, policzone minuty wymagane i faktyczne, identyfikatory konfiguracji i profilu oraz rozbicie wyniku celu.

---

## III. Walidacja wejścia, czasu i planów

| ID | `testLevel` | Kompletny fixture albo pełna zmiana | Oczekiwany status | Oczekiwany `ruleId` | Wymagane / faktyczne |
|---|---|---|---|---|---|
| `IN-T-001` | `INPUT_VALIDATION` | `FIX-INPUT-VALID` | `VALID_INPUT` | `REQ-LEGAL-001` – brak naruszenia w demo | kompletne / kompletne |
| `IN-T-002` | `INPUT_VALIDATION` | kopia `FIX-INPUT-VALID`; jedna granica `14:45` | `INVALID_INPUT` | `REQ-TIME-STEP-001` | wielokrotność 30 / 45 min |
| `IN-T-003` | `INPUT_VALIDATION` | kopia; przedział `[17:00,17:00)` | `INVALID_INPUT` | `REQ-TIME-SAME-DAY-001` | długość > 0 / 0 |
| `IN-T-004` | `INPUT_VALIDATION` | kopia; odcinek od `22:00` jednej daty do `02:00` następnej | `INVALID_INPUT` | `REQ-TIME-SAME-DAY-001` | jedna data / dwie |
| `IN-T-005` | `INPUT_VALIDATION` | kopia; `cycleStartDate = 2026-09-15` | `INVALID_INPUT` | `REQ-CROSS-WEEK-001` | poniedziałek / wtorek |
| `IN-T-006` | `INPUT_VALIDATION` | kopia; brak `weekStartDay` | `INVALID_INPUT` | `REQ-CROSS-WEEK-001` | `MONDAY` / brak |
| `IN-T-007` | `INPUT_VALIDATION` | kopia; brak `timeZoneId` | `INVALID_INPUT` | `REQ-REST-DAILY-001` | `Europe/Warsaw` / brak |
| `IN-T-008` | `INPUT_VALIDATION` | kopia; nieznany identyfikator IANA | `INVALID_INPUT` | `REQ-REST-DAILY-001` | poprawna strefa / nieznana |
| `IN-T-009` | `INPUT_VALIDATION` | kopia; drugi zatwierdzony `BASE_WEEKLY` dla poniedziałku | `INVALID_INPUT` | `REQ-SPECIAL-DAY-001` | 1 plan na klucz / 2 |
| `IN-T-010` | `INPUT_VALIDATION` | kopia; dwa zatwierdzone `CYCLE_WEEK` dla `(3, środa)` | `INVALID_INPUT` | `REQ-SPECIAL-DAY-001` | 1 / 2 |
| `IN-T-011` | `INPUT_VALIDATION` | kopia; dwa zatwierdzone `SPECIFIC_DATE` dla `2026-09-20` | `INVALID_INPUT` | `REQ-SPECIAL-DAY-001` | 1 / 2 |
| `IN-T-012` | `INPUT_VALIDATION` | kopia; dla jednej daty brak planu na wszystkich poziomach | `INVALID_INPUT` | `REQ-SPECIAL-DAY-001` | dokładnie 1 skuteczny / 0 |
| `IN-T-013` | `INPUT_VALIDATION` | kopia; kompletny `SPECIFIC_DATE` zastępuje plan bazowy | `VALID_INPUT` | `REQ-SPECIAL-DAY-001` – brak naruszenia | źródło daty / data |
| `IN-T-014` | `INPUT_VALIDATION` | kopia; `SPECIFIC_DATE` zawiera tylko zmieniony `noCareInterval` | `INVALID_INPUT` | `REQ-SPECIAL-DAY-001` | plan kompletny / częściowy |
| `IN-T-015` | `INPUT_VALIDATION` | kopia; wejście zawiera `Educator.requiredWorkDaysPerWeek = 4` obok globalnej wartości 5 | `INVALID_INPUT` | `REQ-DAYS-001` | jedno źródło / sprzeczny duplikat |
| `IN-T-016` | `INPUT_VALIDATION` | kopia; dodano czwartego wychowawcę D | `INVALID_INPUT` | `REQ-NO-GUESSING-001` | 3 / 4 |
| `IN-T-017` | `INPUT_VALIDATION` | kopia; dodano identyfikator rezerwy lub puli międzygrupowej | `INVALID_INPUT` | `REQ-NO-GUESSING-001` | brak puli / pula |

---

## IV. Kalkulator, normalizacja i pola pochodne

| ID | `testLevel` | Kompletny fixture albo pełna zmiana | Oczekiwany status | Oczekiwany `ruleId` | Wymagane / faktyczne |
|---|---|---|---|---|---|
| `CALC-T-001` | `CALCULATOR_UNIT` | `FIX-DAY-DEMO` | `CALCULATION_OK` | `REQ-COVERAGE-001` – brak naruszenia | 570 / 570 min |
| `CALC-T-002` | `CALCULATOR_UNIT` | `FIX-NORMALIZATION` | `CALCULATION_OK` | `REQ-COVERAGE-001` – brak naruszenia | 300 / 300 min |
| `CALC-T-003` | `CALCULATOR_UNIT` | kopia `FIX-NORMALIZATION`; `operatingIntervals` podane w odwrotnej kolejności | `CALCULATION_OK` | `REQ-COVERAGE-001` – brak naruszenia | ten sam zbiór / 300 min |
| `CALC-T-004` | `CALCULATOR_UNIT` | kopia `FIX-DAY-DEMO`; `noCareIntervals = {[08:00,12:00), [12:00,14:30)}` | `CALCULATION_OK` | `REQ-COVERAGE-001` – brak naruszenia | scalenie styku / 570 min |
| `CALC-T-005` | `INPUT_VALIDATION` | kopia `FIX-DAY-DEMO`; `noCareIntervals` częściowo poza zbiorem działania | `INVALID_INPUT` | `REQ-SPECIAL-DAY-001` | podzbiór / wyjście poza |
| `CALC-T-006` | `CALCULATOR_UNIT` | kopia; poprawnie wyliczony popyt jednego slotu, zapisany `requiredStaffCount = 1` | `CALCULATION_OK` | `REQ-STAFFING-001` – brak naruszenia | 1 / 1 |
| `CALC-T-007` | `CALCULATOR_UNIT` | kopia `CALC-T-006`; przechowywane pole `DERIVED requiredStaffCount = 2` | `INTERNAL_ERROR` | `REQ-VALIDATOR-INDEP-001` | obliczone 1 / zapisane 2 |
| `CALC-T-008` | `CALCULATOR_UNIT` | kopia; `requiredStaffCount` nie występuje w surowym wejściu | `CALCULATION_OK` | `REQ-STAFFING-001` – brak naruszenia | wyliczyć / wyliczono 1 |
| `CALC-T-009` | `CALCULATOR_UNIT` | kopia; dwa kalkulatory niezależnie normalizują `FIX-NORMALIZATION` | `CALCULATION_OK` | `REQ-VALIDATOR-INDEP-001` – brak naruszenia | identyczny zbiór / identyczny |
| `CALC-T-010` | `CALCULATOR_UNIT` | kopia; kalkulator generatora zwraca dodatkowe `[14:00,14:30)`, walidator nie | `INTERNAL_ERROR` | `REQ-VALIDATOR-INDEP-001` | identyczne / rozbieżne |

---

## V. Reguły krytyczne harmonogramu

Każdy przypadek używa pełnej kopii `FIX-V2-CYCLE-INTEGRATION`; zmieniony kandydat pozostaje kompletnym harmonogramem 42 dat.

| ID | `testLevel` | Pełna zmiana kandydata | Oczekiwany status | Oczekiwany `ruleId` | Wymagane / faktyczne |
|---|---|---|---|---|---|
| `RULE-T-001` | `RULE_VALIDATOR_UNIT` | bez zmian | `RULE_SATISFIED` | `REQ-COVERAGE-001` – brak naruszenia | obsada 1 / 1 |
| `RULE-T-002` | `RULE_VALIDATOR_UNIT` | usuń obsadę jednego slotu 30 min | `RULE_VIOLATED` | `REQ-COVERAGE-001` | 1 / 0 |
| `RULE-T-003` | `RULE_VALIDATOR_UNIT` | bez zmian | `RULE_SATISFIED` | `REQ-STAFFING-001` – brak naruszenia | 1 / 1 |
| `RULE-T-004` | `RULE_VALIDATOR_UNIT` | dodaj drugą osobę w jednym wymaganym slocie | `RULE_VIOLATED` | `REQ-STAFFING-001` | 1 / 2 |
| `RULE-T-005` | `RULE_VALIDATOR_UNIT` | bez zmian | `RULE_SATISFIED` | `REQ-NO-OUTSIDE-001` – brak naruszenia | 0 min poza / 0 |
| `RULE-T-006` | `RULE_VALIDATOR_UNIT` | dodaj odcinek `[12:00,14:00)` | `RULE_VIOLATED` | `REQ-NO-OUTSIDE-001` | 0 / 120 min |
| `RULE-T-007` | `RULE_VALIDATOR_UNIT` | bez zmian | `RULE_SATISFIED` | `REQ-SEGMENT-MIN-001` – brak naruszenia | ≥120 / minimum 120 min |
| `RULE-T-008` | `RULE_VALIDATOR_UNIT` | podziel środowy odcinek na 90 i 30 min | `RULE_VIOLATED` | `REQ-SEGMENT-MIN-001` | ≥120 / 30 i 90 min |
| `RULE-T-009` | `RULE_VALIDATOR_UNIT` | bez zmian | `RULE_SATISFIED` | `REQ-DAYS-001` – brak naruszenia | 5 / 5 dni |
| `RULE-T-010` | `RULE_VALIDATOR_UNIT` | przenieś odcinek tak, że A pracuje w 6 datach | `RULE_VIOLATED` | `REQ-DAYS-001` | 5 / 6 dni |
| `RULE-T-011` | `RULE_VALIDATOR_UNIT` | dwa odcinki A w jednej z pięciu dat | `RULE_SATISFIED` | `REQ-DAYS-001` – brak naruszenia | 5 / 5 unikalnych dat |
| `RULE-T-012` | `RULE_VALIDATOR_UNIT` | bez zmian | `RULE_SATISFIED` | `REQ-HOURS-001` – brak naruszenia | 840 / 840 min |
| `RULE-T-013` | `RULE_VALIDATOR_UNIT` | zamień 30 min A na B bez zmiany popytu | `RULE_VIOLATED` | `REQ-HOURS-001` | A/B 840/840 / 810/870 |
| `RULE-T-014` | `RULE_VALIDATOR_UNIT` | `HARD` A `[06:00,09:00)` w dacie, w której A pracuje | `RULE_VIOLATED` | `REQ-UNAVAILABLE-HARD-001` | 0 / 180 min kolizji |
| `RULE-T-015` | `RULE_VALIDATOR_UNIT` | `HARD` A `[12:00,14:00)`, A kończy o 12:00 | `RULE_SATISFIED` | `REQ-UNAVAILABLE-HARD-001` – brak naruszenia | 0 / 0 |
| `RULE-T-016` | `RULE_VALIDATOR_UNIT` | bez zmian | `RULE_SATISFIED` | `REQ-REST-DAILY-001` – brak naruszenia | ≥660 / najkrótszy >660 min |
| `RULE-T-017` | `RULE_VALIDATOR_UNIT` | pełna zmiana dwóch kolejnych dni daje odpoczynek 630 min | `RULE_VIOLATED` | `REQ-REST-DAILY-001` | 660 / 630 min |
| `RULE-T-018` | `RULE_VALIDATOR_UNIT` | bez zmian | `RULE_SATISFIED` | `REQ-REST-WEEKLY-001` – brak naruszenia | ≥2100 / ≥2100 min |
| `RULE-T-019` | `RULE_VALIDATOR_UNIT` | pełna zmiana tygodnia: najdłuższy odpoczynek 2070 min | `RULE_VIOLATED` | `REQ-REST-WEEKLY-001` | 2100 / 2070 min |
| `RULE-T-020` | `RULE_VALIDATOR_UNIT` | bez zmian, jawna granica tydzień 6 → 1 | `RULE_SATISFIED` | `REQ-CROSS-WEEK-001` – brak naruszenia | sprawdzone 6→1 / spełnione |
| `RULE-T-021` | `RULE_VALIDATOR_UNIT` | kolejny tydzień 1 rozpoczyna A po 630 min odpoczynku | `RULE_VIOLATED` | `REQ-CROSS-WEEK-001`, `REQ-REST-DAILY-001` | 660 / 630 min |

---

## VI. Czas rzeczywisty, DST i odpoczynek tygodniowy

Fixtures tej sekcji są pełnymi kopiami `FIX-INPUT-VALID` z zakresem dat przesuniętym tak, aby obejmował wskazane przejście czasu, oraz z kompletnymi planami i przydziałami dla nowego zakresu.

| ID | `testLevel` | Kompletny fixture albo pełna zmiana | Oczekiwany status | Oczekiwany `ruleId` | Wymagane / faktyczne |
|---|---|---|---|---|---|
| `TIME-T-001` | `CALCULATOR_UNIT` | Europe/Warsaw; odpoczynek od `2026-03-28 22:00` do `2026-03-29 10:00` | `CALCULATION_OK` | `REQ-REST-DAILY-001` – brak naruszenia | czas rzeczywisty / 660 min |
| `TIME-T-002` | `CALCULATOR_UNIT` | Europe/Warsaw; odpoczynek od `2026-10-24 22:00` do `2026-10-25 10:00` | `CALCULATION_OK` | `REQ-REST-DAILY-001` – brak naruszenia | czas rzeczywisty / 780 min |
| `TIME-T-003` | `INPUT_VALIDATION` | granica lokalna w nieistniejącym czasie podczas zmiany wiosennej | `INVALID_INPUT` | `REQ-TIME-SAME-DAY-001` | jednoznaczny instant / brak |
| `TIME-T-004` | `INPUT_VALIDATION` | granica lokalna w powtórzonej godzinie jesiennej bez wskazania offsetu | `INVALID_INPUT` | `REQ-TIME-SAME-DAY-001` | jednoznaczny instant / dwa |
| `TIME-T-005` | `RULE_VALIDATOR_UNIT` | pełny tydzień, okno od poniedziałku `00:00`, przypisanie `INTERSECTION_WITH_WINDOW` | `RULE_SATISFIED` | `REQ-REST-WEEKLY-001` – brak naruszenia | struktura jawna / zgodna |
| `TIME-T-006` | `INPUT_VALIDATION` | brak `weeklyRestWindowType` albo kotwicy | `INVALID_INPUT` | `REQ-REST-WEEKLY-001` | kompletna struktura / brak |
| `TIME-T-007` | `INPUT_VALIDATION` | `weeklyRestExceptionEnabled = true`, brak wymaganej konfiguracji kompensacji | `INVALID_INPUT` | `REQ-REST-WEEKLY-001` | kompensacja jawna / brak |

---

## VII. Dokładne wzorce weekendowe

| ID | `testLevel` | Kompletny fixture albo pełna zmiana | Oczekiwany status | Oczekiwany `ruleId` | Wymagane / faktyczne |
|---|---|---|---|---|---|
| `WV2-T-001` | `RULE_VALIDATOR_UNIT` | `FIX-V2-WEEKEND-APPROVED`, pozycja 1; rzeczywiste krotki obu dni identyczne z szablonem | `RULE_SATISFIED` | `REQ-WEEKEND-001` – brak naruszenia | 4 krotki / 4 identyczne |
| `WV2-T-002` | `RULE_VALIDATOR_UNIT` | kopia pozycji 1; zatwierdzony szablon niedzieli: A `[06:00,14:30)`, B `[14:30,22:00)`; kandydat identyczny | `RULE_SATISFIED` | `REQ-WEEKEND-001` – brak naruszenia | sob. 14:00, niedz. 14:30 / zgodne |
| `WV2-T-003A` | `RULE_VALIDATOR_UNIT` | `FIX-V2-WEEKEND-APPROVED`, pozycja 1; A odpoczywa sob. 14:00 → niedz. 06:00, B sob. 22:00 → niedz. 14:00 | `RULE_SATISFIED` | `REQ-REST-DAILY-001` – brak naruszenia | 660 / A 960, B 960 min |
| `WV2-T-003B` | `RULE_VALIDATOR_UNIT` | kopia pozycji 1; zatwierdzona niedziela: B `[06:00,14:00)`, A `[14:00,22:00)` | `RULE_VIOLATED` | `REQ-REST-DAILY-001` | 660 / B 480 min |
| `WV2-T-004` | `RULE_VALIDATOR_UNIT` | `FIX-V2-WEEKEND-APPROVED`; kandydat sobota A `[06:00,14:00)`, B `[14:30,22:00)` | `RULE_VIOLATED` | `REQ-COVERAGE-001`, `REQ-WEEKEND-001` | obsada 1 i start 14:00 / 0 w 14:00–14:30, start 14:30 |
| `WV2-T-005` | `RULE_VALIDATOR_UNIT` | `FIX-V2-WEEKEND-APPROVED`; kandydat sobota A `[06:00,14:00)`, B `[13:30,22:00)` | `RULE_VIOLATED` | `REQ-STAFFING-001`, `REQ-WEEKEND-001` | obsada 1 i start 14:00 / 2 w 13:30–14:00, start 13:30 |
| `WV2-T-006` | `SOLVER_INTEGRATION` | `FIX-V2-CYCLE-INTEGRATION`; generator zamienia osoby z niedzielnych odcinków M i P tygodnia 1, zachowując pokrycie | `INTERNAL_ERROR`; publicznie `BLAD_WEWNETRZNY` | `REQ-WEEKEND-001` | 2 dokładne osoby / 2 zamienione |
| `WV2-T-007` | `INPUT_VALIDATION` | kopia pozycji 1; kompletny `SPECIFIC_DATE` soboty daje popyt `[06:00,22:30)`; brak `SUBSTITUTE` | `INVALID_INPUT` | `REQ-SPECIAL-DAY-001` | pokrycie do 22:30 / brak 30 min wzorca |
| `WV2-T-008` | `INPUT_VALIDATION` | jak wyżej; jeden zatwierdzony `SUBSTITUTE`: sobota A `[06:00,14:00)`, B `[14:00,22:30)`; niedziela bez zmian | `VALID_INPUT` | `REQ-SPECIAL-DAY-001` – brak naruszenia | dokładne pokrycie / zgodne |
| `WV2-T-009` | `RULE_VALIDATOR_UNIT` | pełne sześć weekendów, pozycje 1–6, potem pozycja 1 kolejnego cyklu | `RULE_SATISFIED` | `REQ-ROTATION-001` – brak naruszenia | 1,2,3,4,5,6,1 / zgodne |
| `WV2-T-010` | `RULE_VALIDATOR_UNIT` | kopia; kolejność wariantów 1,2,3,5,5,6 | `RULE_VIOLATED` | `REQ-ROTATION-001` | 1,2,3,4,5,6 / 1,2,3,5,5,6 |
| `WV2-T-011` | `RULE_VALIDATOR_UNIT` | kopia pozycji 1; kandydat ma poprawne osoby i czasy, lecz `sequenceNumber` 2,1 | `RULE_VIOLATED` | `REQ-WEEKEND-001` | 1,2 / 2,1 |
| `WV2-T-012` | `INPUT_VALIDATION` | kopia; dwa zatwierdzone `SUBSTITUTE` dla tej samej daty i wariantu | `INVALID_INPUT` | `REQ-SPECIAL-DAY-001` | najwyżej 1 / 2 |
| `WV2-T-013` | `INPUT_VALIDATION` | kopia; A ma `canWorkWeekends = false`, a występuje w zatwierdzonym wariancie | `INVALID_INPUT` | `REQ-WEEKEND-001` | wszyscy dopuszczeni / A niedopuszczony |

`WV2-T-003B` bada zachowanie walidatora wobec jawnej wartości testowej. Nie jest oceną prawną rzeczywistego wzorca placówki.

---

## VIII. Funkcja celu i deterministyczność

Wzory:

- `P_afternoon = Σ |handoverMinute - preferredAfternoonHandoverMinute| / timeStepMinutes`;
- `P_weekend = Σ |assignedMinutes - preferredWeekendSplitMinutes| / timeStepMinutes`, osobno dla obu osób i obu dni;
- `P_splitDays = Σ max(0, segmentCount(educator, date) - 1)`;
- `P_longSegments = Σ max(0, segmentMinutes - preferredMaximumSegmentMinutes) / timeStepMinutes`;
- `P_preferredUnavailable` = liczba przypisanych slotów przecinających znormalizowane `PREFERRED` po dominacji `HARD`;
- `objectiveScore = wA × P_afternoon + wW × P_weekend + wS × P_splitDays + wL × P_longSegments + wU × P_preferredUnavailable`.

| ID | `testLevel` | Kompletny fixture albo pełna zmiana | Oczekiwany status | Oczekiwany `ruleId` | Wymagane / faktyczne |
|---|---|---|---|---|---|
| `OBJ-T-001` | `CALCULATOR_UNIT` | kopia `FIX-INPUT-VALID`; jedno przekazanie dokładnie o 17:00 | `CALCULATION_OK` | `REQ-PREF-AFTERNOON-001` | 0 / 0 |
| `OBJ-T-002` | `CALCULATOR_UNIT` | kopia; przekazanie 16:30, krok 30 min | `CALCULATION_OK` | `REQ-PREF-AFTERNOON-001` | 1 / 1 slot |
| `OBJ-T-003` | `CALCULATOR_UNIT` | kopia; sobota i niedziela po 480 min dla każdej z dwóch osób, `preferredWeekendSplitMinutes = 480` | `CALCULATION_OK` | `REQ-PREF-WEEKEND-SPLIT-001` | 0 / 0 |
| `OBJ-T-004` | `CALCULATOR_UNIT` | kopia; sobota 510/450 min, niedziela 480/480 min, preferowane 480 | `CALCULATION_OK` | `REQ-PREF-WEEKEND-SPLIT-001` | `(30+30+0+0)/30 = 2` / 2 |
| `OBJ-T-005` | `CALCULATOR_UNIT` | kopia; dwa przypadki `(educator, date)` mają po 2 odcinki, pozostałe po 1 | `CALCULATION_OK` | `REQ-PREF-SPLIT-DAYS-001` | `1+1 = 2` / 2 |
| `OBJ-T-006` | `CALCULATOR_UNIT` | kopia; odcinki 480, 510 i 540 min, preferowane maksimum 480 | `CALCULATION_OK` | `REQ-PREF-LONG-SEGMENT-001` | 0+1+2 / 3 |
| `OBJ-T-007` | `CALCULATOR_UNIT` | kopia; przecięcie z `PREFERRED` przez 3 sloty | `CALCULATION_OK` | `REQ-PREF-UNAVAILABLE-001` | 3 / 3 |
| `OBJ-T-008` | `CALCULATOR_UNIT` | kary 1,2,3,4,5 i wagi 5,4,3,2,1 | `CALCULATION_OK` | wszystkie `REQ-PREF-*` | 35 / 35 |
| `OBJ-T-009` | `SOLVER_INTEGRATION` | dwa wykonalne rozwiązania: score 10 i 11 | `CANDIDATE_FOUND` | `REQ-NO-GUESSING-001` – brak naruszenia | minimum / 10 |
| `OBJ-T-010` | `SOLVER_INTEGRATION` | dwa rozwiązania o score 10; różne kanoniczne listy krotek | `CANDIDATE_FOUND` | `REQ-NO-GUESSING-001` – brak naruszenia | minimum leksykograficzne / wybrane |
| `OBJ-T-011` | `SOLVER_INTEGRATION` | dwa uruchomienia `FIX-V2-CYCLE-INTEGRATION`, te same dane i seed | `CANDIDATE_FOUND` | `REQ-NO-GUESSING-001` – brak naruszenia | identyczny cykl, score i breakdown / identyczne |

---

## IX. Integralność złożona

| ID | `testLevel` | Kompletny fixture albo pełna zmiana | Oczekiwany status | Oczekiwany `ruleId` | Wymagane / faktyczne |
|---|---|---|---|---|---|
| `INT-T-001` | `INPUT_VALIDATION` | `FIX-INPUT-VALID` | `VALID_INPUT` | `REQ-NO-GUESSING-001` – brak naruszenia | jedna wersja i grupa / zgodne |
| `INT-T-002` | `INPUT_VALIDATION` | kopia; `SPECIFIC_DATE.configurationVersionId = CV-OLD` | `INVALID_INPUT` | `REQ-SPECIAL-DAY-001` | CV-TEST-01 / CV-OLD |
| `INT-T-003` | `INPUT_VALIDATION` | kopia; jeden plan wskazuje `G2` | `INVALID_INPUT` | `REQ-NO-GUESSING-001` | G1 / G2 |
| `INT-T-004` | `INPUT_VALIDATION` | kopia; niedostępność wskazuje wychowawcę spoza konfiguracji | `INVALID_INPUT` | `REQ-UNAVAILABLE-HARD-001` | A/B/C / D |
| `INT-T-005` | `INPUT_VALIDATION` | kopia; dwa aktywne `OrganizationRules` dla tej samej wersji | `INVALID_INPUT` | `REQ-NO-GUESSING-001` | 1 / 2 |
| `INT-T-006` | `INPUT_VALIDATION` | kopia; dwa profile prawne aktywne dla uruchomienia | `INVALID_INPUT` | `REQ-LEGAL-001` | 1 / 2 |
| `INT-T-007` | `INPUT_VALIDATION` | kopia; wariant weekendowy zawiera wychowawcę z innej wersji | `INVALID_INPUT` | `REQ-WEEKEND-001` | CV-TEST-01 / CV-OLD |
| `INT-T-008` | `INPUT_VALIDATION` | kopia; `WeekendDayTemplate.weekendRotationVariantId` wskazuje wariant inny niż wybrany dla tygodnia | `INVALID_INPUT` | `REQ-WEEKEND-001` | wariant wybrany / inny |
| `INT-T-009` | `INPUT_VALIDATION` | kopia; przydział wskazuje plan nieskuteczny dla daty | `INVALID_INPUT` | `REQ-SPECIAL-DAY-001` | plan skuteczny / nieskuteczny |

---

## X. Macierz trybu prawnego

Każdy przypadek jest pełną kopią `FIX-E2E-VERIFIED`, a wskazane pola profilu zastępują wartości bazowe.

| ID | `testLevel` | `verificationStatus` / tryb | Oczekiwany status | Oczekiwany `ruleId` | Wymagane / faktyczne |
|---|---|---|---|---|---|
| `LEGAL-T-001` | `INPUT_VALIDATION` | `VERIFIED` / `PRODUCTION` | `VALID_INPUT` | `REQ-LEGAL-001` – brak naruszenia | produkcja dozwolona / tak |
| `LEGAL-T-002` | `INPUT_VALIDATION` | `VERIFIED` / `DEMONSTRATION` | `VALID_INPUT` z obowiązkowym oznaczeniem demo | `REQ-LEGAL-001` – brak naruszenia | demo oznaczone / tak |
| `LEGAL-T-003` | `INPUT_VALIDATION` | `UNVERIFIED` / `PRODUCTION` | `INVALID_INPUT` | `REQ-LEGAL-001` | VERIFIED / UNVERIFIED |
| `LEGAL-T-004` | `INPUT_VALIDATION` | `UNVERIFIED` / `DEMONSTRATION` | `VALID_INPUT` z obowiązkowym ostrzeżeniem | `REQ-LEGAL-001` – brak naruszenia | demo + ostrzeżenie / tak |
| `LEGAL-T-005` | `INPUT_VALIDATION` | `EXPIRED` / `PRODUCTION` | `INVALID_INPUT` | `REQ-LEGAL-001` | VERIFIED / EXPIRED |
| `LEGAL-T-006` | `INPUT_VALIDATION` | `EXPIRED` / `DEMONSTRATION` | `VALID_INPUT` z obowiązkowym ostrzeżeniem o wygaśnięciu | `REQ-LEGAL-001` – brak naruszenia | demo + ostrzeżenie / tak |
| `LEGAL-T-007` | `INPUT_VALIDATION` | `VERIFIED` / `PRODUCTION`, lecz cykl poza zakresem profilu | `INVALID_INPUT` | `REQ-LEGAL-001` | data w zakresie / poza |
| `LEGAL-T-008` | `INPUT_VALIDATION` | `VERIFIED` bez `approvedBy` i `sourceIdentifier` | `INVALID_INPUT` | `REQ-LEGAL-001` | pełny ślad / niepełny |

---

## XI. Solver, walidator i statusy publiczne

| ID | `testLevel` | Kompletny fixture albo pełna zmiana | Oczekiwany status | Oczekiwany `ruleId` | Wymagane / faktyczne |
|---|---|---|---|---|---|
| `SOL-T-001` | `SOLVER_INTEGRATION` | `FIX-V2-CYCLE-INTEGRATION` | `CANDIDATE_FOUND` | wszystkie krytyczne – brak naruszeń | wykonalny / znaleziony |
| `SOL-T-002` | `SOLVER_INTEGRATION` | kopia; jedna data ma wyłącznie 90 min popytu, segment min. 120, godziny tygodniowe zbilansowane | `NO_SOLUTION` | `REQ-COVERAGE-001`, `REQ-NO-OUTSIDE-001`, `REQ-SEGMENT-MIN-001` | ≥120 i 0 poza / tylko 90 min |
| `SOL-T-003` | `SOLVER_INTEGRATION` | kopia; limit czasu przed dowodem rozwiązania lub jego braku | `TIME_LIMIT` | `REQ-NO-GUESSING-001` | wynik końcowy / brak |
| `SOL-T-004` | `SOLVER_INTEGRATION` | kopia; solver zwraca kandydata z luką 30 min | `INTERNAL_ERROR`; publicznie `BLAD_WEWNETRZNY` | `REQ-COVERAGE-001`, `REQ-VALIDATOR-INDEP-001` | obsada 1 / 0 |
| `SOL-T-005` | `SOLVER_INTEGRATION` | kopia; zapisane `assignedMinutes = 840`, suma odcinków 810 | `INTERNAL_ERROR` | `REQ-HOURS-001`, `REQ-VALIDATOR-INDEP-001` | 840 / 810 |
| `SOL-T-006` | `SOLVER_INTEGRATION` | kopia `SOL-T-002`; kompletny raport konfliktu ma `conflictAnalysisQuality = APPROXIMATE` | `NO_SOLUTION` | konfliktowe reguły z raportu | jakość jawna / APPROXIMATE |
| `SOL-T-007` | `SOLVER_INTEGRATION` | kopia `SOL-T-006`; raport nie zawiera `conflictAnalysisQuality` | `INTERNAL_ERROR`; publicznie `BLAD_WEWNETRZNY` | `REQ-NO-GUESSING-001` | pole wymagane / brak |
| `E2E-T-001` | `END_TO_END` | `FIX-E2E-VERIFIED` i pełny oczekiwany raport | `VALID`; publicznie `POPRAWNY` | wszystkie krytyczne – brak naruszeń | 0 naruszeń / 0 |
| `E2E-T-002` | `END_TO_END` | kopia `FIX-E2E-VERIFIED`; ręczny kompletny kandydat ma lukę 30 min; pełny oczekiwany raport zawiera naruszenie | `INVALID`; publicznie `BLAD_WEWNETRZNY` | `REQ-COVERAGE-001` | obsada 1 / 0 |
| `E2E-T-005` | `END_TO_END` | pełna kopia `FIX-V2-CYCLE-INTEGRATION` w `UNVERIFIED/DEMONSTRATION` wraz z pełnym raportem | `VALID`; publicznie `POPRAWNY_TRYB_DEMONSTRACYJNY` | `REQ-LEGAL-001` – brak naruszenia | ostrzeżenie demo / obecne |

---

## XII. Macierz testów reguł krytycznych

| `ruleId` | Co najmniej jeden test poprawny | Co najmniej jeden test niepoprawny |
|---|---|---|
| `REQ-NO-GUESSING-001` | `INT-T-001`, `OBJ-T-011` | `IN-T-017`, `INT-T-003`, `SOL-T-007` |
| `REQ-SPECIAL-DAY-001` | `IN-T-013`, `WV2-T-008` | `IN-T-009`–`IN-T-012`, `WV2-T-007` |
| `REQ-TIME-STEP-001` | `IN-T-001` | `IN-T-002` |
| `REQ-TIME-SAME-DAY-001` | `IN-T-001` | `IN-T-003`, `IN-T-004`, `TIME-T-003`, `TIME-T-004` |
| `REQ-SEGMENT-MIN-001` | `RULE-T-007` | `RULE-T-008`, `SOL-T-002` |
| `REQ-COVERAGE-001` | `RULE-T-001` | `RULE-T-002`, `WV2-T-004`, `E2E-T-002` |
| `REQ-STAFFING-001` | `RULE-T-003`, `CALC-T-006` | `RULE-T-004`, `WV2-T-005` |
| `REQ-NO-OUTSIDE-001` | `RULE-T-005` | `RULE-T-006`, `SOL-T-002` |
| `REQ-HOURS-001` | `RULE-T-012` | `RULE-T-013`, `SOL-T-005` |
| `REQ-DAYS-001` | `RULE-T-009`, `RULE-T-011` | `RULE-T-010`, `IN-T-015` |
| `REQ-UNAVAILABLE-HARD-001` | `RULE-T-015` | `RULE-T-014` |
| `REQ-REST-DAILY-001` | `RULE-T-016`, `TIME-T-001`, `TIME-T-002`, `WV2-T-003A` | `RULE-T-017`, `WV2-T-003B` |
| `REQ-REST-WEEKLY-001` | `RULE-T-018`, `TIME-T-005` | `RULE-T-019`, `TIME-T-006`, `TIME-T-007` |
| `REQ-WEEKEND-001` | `WV2-T-001`, `WV2-T-002` | `WV2-T-004`–`WV2-T-006`, `WV2-T-011`, `WV2-T-013` |
| `REQ-ROTATION-001` | `WV2-T-009` | `WV2-T-010` |
| `REQ-CROSS-WEEK-001` | `RULE-T-020` | `IN-T-005`, `IN-T-006`, `RULE-T-021` |
| `REQ-VALIDATOR-INDEP-001` | `CALC-T-009`, `E2E-T-001` | `CALC-T-007`, `CALC-T-010`, `SOL-T-004`, `SOL-T-005` |
| `REQ-LEGAL-001` | `LEGAL-T-001`, `LEGAL-T-002`, `LEGAL-T-004`, `LEGAL-T-006` | `LEGAL-T-003`, `LEGAL-T-005`, `LEGAL-T-007`, `LEGAL-T-008` |

Każda reguła krytyczna ma co najmniej jeden test poprawny i jeden niepoprawny.

---

## XIII. Rejestr stabilnych identyfikatorów

Reguły krytyczne:

`REQ-NO-GUESSING-001`, `REQ-SPECIAL-DAY-001`, `REQ-TIME-STEP-001`, `REQ-TIME-SAME-DAY-001`, `REQ-SEGMENT-MIN-001`, `REQ-COVERAGE-001`, `REQ-STAFFING-001`, `REQ-NO-OUTSIDE-001`, `REQ-HOURS-001`, `REQ-DAYS-001`, `REQ-UNAVAILABLE-HARD-001`, `REQ-REST-DAILY-001`, `REQ-REST-WEEKLY-001`, `REQ-WEEKEND-001`, `REQ-ROTATION-001`, `REQ-CROSS-WEEK-001`, `REQ-VALIDATOR-INDEP-001`, `REQ-LEGAL-001`.

Preferencje:

`REQ-PREF-AFTERNOON-001`, `REQ-PREF-WEEKEND-SPLIT-001`, `REQ-PREF-SPLIT-DAYS-001`, `REQ-PREF-LONG-SEGMENT-001`, `REQ-PREF-UNAVAILABLE-001`.

Każdy komunikat naruszenia, raport konfliktu i wpis `ValidationReport` używa dokładnie identyfikatora z rejestru, a nie numeru rozdziału ani tekstu komunikatu.

---

## XIV. Kryteria zakończenia etapu

Etap dokumentacyjny testów jest zakończony, gdy:

1. każdy przypadek ma `testLevel`, kompletny fixture lub pełną kopię fixture i jawny wynik;
2. status wyniku odpowiada poziomowi testu;
3. `VALID` i `INVALID` występują wyłącznie w testach `END_TO_END` pełnego `ValidationReport`;
4. każda reguła krytyczna ma test spełnienia i naruszenia;
5. testy wzorców weekendowych porównują dokładne krotki, a nie role prezentacyjne;
6. testy DST mierzą czas rzeczywisty w `Europe/Warsaw`;
7. testy obejmują unikalność planów, poniedziałkową kotwicę, normalizację zbiorów, błędy pól `DERIVED`, integralność złożoną, pełną funkcję celu i macierz trybu prawnego;
8. dane oczekiwane walidatora nie są wyprowadzane kodem generatora;
9. testy pozostają danymi projektowymi; niniejszy dokument nie stanowi implementacji.
