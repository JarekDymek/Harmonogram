# MODEL DANYCH APLIKACJI

## 1. Cel dokumentu

Dokument opisuje logiczny model danych pierwszej wersji. Nie jest schematem bazy danych ani kodem konkretnej technologii.

Model obsługuje:

* jedną grupę,
* dokładnie trzech wychowawców,
* sześciotygodniowy cykl kołowy,
* przejście tydzień 6 → tydzień 1,
* kompletne plany dni,
* dynamiczne zapotrzebowanie,
* przydziały podstawowe i zastępcze,
* niedostępności,
* konfigurację prawną i organizacyjną,
* generator, niezależny walidator i raporty.

Pierwsza wersja nie zawiera wychowawcy rezerwowego, puli międzygrupowej ani podwójnej obsady.

Ręczna edycja, blokowanie zmian, JSON, baza danych, wiele grup i porównanie z poprzednim harmonogramem są poza zakresem pierwszej wersji.

---

# I. ZASADY MODELOWANIA

## 1. Czas i daty

* Na granicy systemu czas ma format `HH:MM`.
* W obliczeniach czas jest liczbą minut od północy albo indeksem slotu.
* Krok pierwszej wersji wynosi 30 minut.
* Data ma format `YYYY-MM-DD`.
* Przedziały są półotwarte `[początek, koniec)`.
* Odcinek nie przechodzi przez północ.
* `cycleStartDate` przypada w poniedziałek, a `weekStartDay = MONDAY`.
* `timeZoneId` jest jawnym identyfikatorem IANA; w V1 widocznie wstępnie wybraną wartością jest `Europe/Warsaw`.
* Odpoczynki są liczone jako rzeczywiste minuty na osi czasu.
* Nieistniejąca albo niejednoznaczna lokalna granica czasu jest niepoprawnym wejściem.

## 2. Identyfikatory

Każda główna encja ma niezmienny, unikalny identyfikator techniczny.

Każda reguła ma stabilne `ruleId`, niezależne od numeru sekcji dokumentu.

## 3. Kierunek relacji

Autorytatywna jest referencja:

`dziecko → rodzic`

Tablice identyfikatorów dzieci nie są niezależnym źródłem prawdy. Mogą być wyłącznie widokami lub wynikami zapytania.

## 4. Wersjonowanie

Wersja konfiguracji staje się niemodyfikowalna po rozpoczęciu generowania.

Zmiana danych tworzy nową wersję. Harmonogram i raporty zawsze wskazują używaną wersję.

## 5. Pola pochodne

Pola pochodne są oznaczone jako `DERIVED`.

Walidator oblicza je ponownie ze źródeł. Jeżeli są materializowane, ich zgodność musi zostać sprawdzona.

## 6. Brak ukrytych wartości

Każda wartość używana przez generator jest:

* jawnie zapisana,
* widoczna dla użytkownika,
* objęta walidacją.

---

# II. PROJEKT I WERSJA KONFIGURACJI

## 1. `ScheduleProject`

Pola:

* `id`,
* `name`,
* `description`,
* `createdAt`,
* `updatedAt`,
* `status`.

Statusy projektu:

* `DRAFT`,
* `CONFIGURED`,
* `GENERATED`,
* `ARCHIVED`.

Aktywną wersję określa się jako zatwierdzoną wersję dziecka projektu, a nie przez niezależną tablicę identyfikatorów.

## 2. `ScheduleConfigurationVersion`

Pola:

* `id`,
* `projectId`,
* `versionNumber`,
* `createdAt`,
* `createdBy`,
* `cycleStartDate`,
* `weekStartDay`,
* `timeZoneId`,
* `cycleLengthWeeks`,
* `cycleIsRepeating`,
* `startingWeekendVariant`,
* `inputValidationStatus` (`DERIVED`).

Ograniczenia pierwszej wersji:

* `cycleStartDate` przypada w poniedziałek,
* `weekStartDay = MONDAY`,
* `timeZoneId` jest wymagane,
* `cycleLengthWeeks = 6`,
* `cycleIsRepeating = true`.

Krok czasowy pochodzi wyłącznie z dziecka `OrganizationalRulesConfiguration.timeStepMinutes`.

Statusy `inputValidationStatus`:

* `NOT_VALIDATED`,
* `VALID_INPUT`,
* `INVALID_INPUT`.

---

# III. GRUPA I WYCHOWAWCY

## 1. `EducationalGroup`

Pola:

* `id`,
* `configurationVersionId`,
* `displayName`,
* `shortName`,
* `active`.

Pierwsza wersja wymaga dokładnie jednej aktywnej grupy.

## 2. `Educator`

Pola:

* `id`,
* `groupId`,
* `displayName`,
* `shortCode`,
* `baseWeeklyAssignedMinutes`,
* `active`.

Nie występują:

* `requiredWorkDaysPerWeek` – źródłem jest konfiguracja organizacyjna,
* konfigurowalne `canWorkWeekends` – cała trójka musi być dopuszczona do weekendów.

## 3. `EducatorWeekAssignmentOverride`

Pola:

* `id`,
* `educatorId`,
* `configurationVersionId`,
* `weekNumber`,
* `assignedMinutes`,
* `reason`,
* `approvedAt`,
* `approvedBy`.

Ograniczenia:

* `weekNumber` należy do 1–6,
* może istnieć najwyżej jeden zatwierdzony wpis dla pary wychowawca–tydzień,
* wpis zastępuje `baseWeeklyAssignedMinutes`,
* generator nie tworzy ani nie proponuje wpisu.

---

# IV. NIEDOSTĘPNOŚĆ

## `EducatorUnavailability`

Pola:

* `id`,
* `educatorId`,
* `scope`,
* `date`,
* `weekNumber`,
* `dayOfWeek`,
* `startTime`,
* `endTime`,
* `type`,
* `description`.

`scope`:

* `RECURRING_WEEKLY`,
* `CYCLE_WEEK`,
* `SPECIFIC_DATE`.

`type`:

* `HARD`,
* `PREFERRED`.

Warunki:

* `RECURRING_WEEKLY` wymaga `dayOfWeek`,
* `CYCLE_WEEK` wymaga `weekNumber` i `dayOfWeek`,
* `SPECIFIC_DATE` wymaga `date`,
* wszystkie zakresy są sumowane,
* wpisy tego samego typu są scalane,
* `HARD` dominuje nad `PREFERRED`.

---

# V. KOMPLETNY PLAN DNIA

## 1. `DayCarePlan`

Encja reprezentuje kompletny stan dnia, a nie częściową zmianę.

Pola:

* `id`,
* `configurationVersionId`,
* `groupId`,
* `scope`,
* `dayOfWeek`,
* `weekNumber`,
* `date`,
* `eventType`,
* `customEventType`,
* `description`,
* `approvedAt`,
* `approvedBy`.

`scope`:

* `BASE_WEEKLY`,
* `CYCLE_WEEK`,
* `SPECIFIC_DATE`.

Warunki:

* `BASE_WEEKLY` wymaga `dayOfWeek`,
* `CYCLE_WEEK` wymaga `weekNumber` i `dayOfWeek`,
* `SPECIFIC_DATE` wymaga `date`,
* istnienie `SPECIFIC_DATE` oznacza pełne zastąpienie niższych poziomów,
* nie występuje `replacesWeeklyPlan`,
* nie występują częściowe operacje `ADD`, `REMOVE` ani `REPLACE_INTERVAL`.

Unikalność zatwierdzonych planów:

* `BASE_WEEKLY`: `configurationVersionId`, `groupId`, `scope`, `dayOfWeek`,
* `CYCLE_WEEK`: `configurationVersionId`, `groupId`, `scope`, `weekNumber`, `dayOfWeek`,
* `SPECIFIC_DATE`: `configurationVersionId`, `groupId`, `scope`, `date`.

Dla każdego dnia tygodnia istnieje dokładnie jeden zatwierdzony `BASE_WEEKLY`; dla pozostałych kluczy najwyżej jeden. Dla każdej z 42 dat hierarchia wyprowadza dokładnie jeden skuteczny plan. Kolejność rekordów nie jest źródłem wyboru.

`eventType` korzysta z kontrolowanej listy zdefiniowanej dla `NoInternatCareInterval`. `customEventType` jest wymagane, gdy `eventType = CUSTOM`, i puste dla pozostałych typów.

## 2. `InternatOperatingInterval`

Pola:

* `id`,
* `dayCarePlanId`,
* `groupId`,
* `startTime`,
* `endTime`,
* `description`.

## 3. `NoInternatCareInterval`

Pola:

* `id`,
* `dayCarePlanId`,
* `groupId`,
* `startTime`,
* `endTime`,
* `eventType`,
* `customEventType`,
* `description`.

`eventType`:

* `SCHOOL`,
* `INTERNSHIP`,
* `TRIP`,
* `CEREMONY`,
* `ACTIVITY_OUTSIDE`,
* `OTHER_CARE`,
* `CUSTOM`.

`customEventType` jest wymagane dla `CUSTOM` i puste dla pozostałych wartości.

Przedziały obu encji:

* są półotwarte,
* mają dodatnią długość,
* mają granice zgodne z 30 minutami,
* nie przechodzą przez północ.

Każda lista jest normalizowana jako zbiór: rekordy są sortowane, a przedziały nakładające się i stykające są scalane do rozłącznej listy kanonicznej. `NoInternatCareInterval` musi w całości należeć do sumy `InternatOperatingInterval`, inaczej dane są `INVALID_INPUT`.

---

# VI. OBLICZONE ZAPOTRZEBOWANIE

## 1. `CalculatedCareRequirement`

Pola:

* `id`,
* `configurationVersionId`,
* `groupId`,
* `date`,
* `appliedDayCarePlanId` (`DERIVED` przez hierarchię planów),
* `totalRequiredMinutes` (`DERIVED`),
* `calculationTimestamp`,
* `calculationVersion`.

Jest to wynik kalkulatora, nie źródło prawdy dla walidatora.

## 2. `RequiredCareInterval`

Pola:

* `id`,
* `careRequirementId`,
* `groupId`,
* `startTime` (`DERIVED`),
* `endTime` (`DERIVED`),
* `requiredStaffCount` (`DERIVED` z reguły pierwszej wersji).

W pierwszej wersji:

`requiredStaffCount = 1`

Pole nie należy do danych użytkownika. Inna wartość w wyniku kalkulatora oznacza `INTERNAL_ERROR`, publicznie `BLAD_WEWNETRZNY`, z głównym `REQ-VALIDATOR-INDEP-001` i kontekstem `REQ-STAFFING-001`.

---

# VII. KONFIGURACJA REGUŁ

## 1. `LegalRulesConfiguration`

Pola:

* `id`,
* `configurationVersionId`,
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
* `maximumAbsoluteDailyWorkMinutes`,
* `maximumAbsoluteSegmentMinutes`.

`verificationStatus`:

* `UNVERIFIED`,
* `VERIFIED`,
* `EXPIRED`.

`weeklyRestWindowType`:

* `FIXED_LOCAL_WEEK`,
* `ROLLING_DURATION`.

`weeklyRestAttributionMode`:

* `FULLY_CONTAINED`,
* `INTERSECTION_WITH_WINDOW`.

Pola nieużywane przez wybrany typ albo wyłączony wyjątek są jawnie puste. W profilu `VERIFIED` cała metoda, wyjątki, kompensacja i każda używana wartość należą do zatwierdzonego śladu prawnego.

Brak limitu zatwierdzonego prawnie nie oznacza, że limit nie istnieje. Wartości 11 i 35 godzin pozostają robocze do zewnętrznej weryfikacji.

## 2. `OrganizationalRulesConfiguration`

Pola:

* `id`,
* `configurationVersionId`,
* `timeStepMinutes`,
* `minimumSegmentMinutes`,
* `requiredWorkDaysPerWeek`,
* `weekendRotationEnabled`,
* `preferredMaximumSegmentMinutes`,
* `preferredAfternoonHandoverTime`,
* `preferredWeekendSplitMinutes`,
* `splitDayPenaltyWeight`,
* `preferredUnavailabilityPenaltyWeight`,
* `longSegmentPenaltyWeight`,
* `weekendImbalancePenaltyWeight`,
* `afternoonHandoverPenaltyWeight`.

W pierwszej wersji:

* `timeStepMinutes = 30`,
* `minimumSegmentMinutes = 120`,
* `requiredWorkDaysPerWeek = 5`,
* `weekendRotationEnabled = true`,
* nie występuje `allowDoubleStaffing`.

Wszystkie wagi są jawnymi, nieujemnymi liczbami całkowitymi.

Jedynym polem liczbowym obsady pozostaje `RequiredCareInterval.requiredStaffCount`. Materializuje ono regułę pierwszej wersji i zawsze ma wartość `1`; nie jest konfigurowalnym drugim źródłem prawdy.

## 3. `WeekendRotationVariant`

Pola źródłowe:

* `id`,
* `configurationVersionId`,
* `variantKind`,
* `positionInCycle`,
* `replacesWeekendRotationVariantId`,
* `applicableWeekNumber`,
* `applicableSaturdayDate`,
* `applicableSundayDate`,
* `offEducatorId`,
* `approved`,
* `approvalReference`,
* `approvedAt`,
* `approvedBy`.

`variantKind`:

* `BASE`,
* `SUBSTITUTE`.

Dla `BASE` wymagane jest `positionInCycle`, a pola zastępstwa są puste. Dla `SUBSTITUTE` wymagane są: zastępowany wariant, tydzień oraz daty soboty i niedzieli; `positionInCycle` jest puste.

Pola widokowe `DERIVED`, jeżeli pozostają w modelu:

* `workingEducatorIds`,
* `saturdayTemplateId`,
* `sundayTemplateId`.

`workingEducatorIds` wyprowadza się z dzieci `WeekendAssignmentTemplate`, a identyfikatory szablonów z dzieci `WeekendDayTemplate`; pola te nie są równoległym źródłem prawdy.

Wersja zawiera dokładnie sześć zatwierdzonych wariantów `BASE` o unikalnych pozycjach 1–6. `SUBSTITUTE` nie zmienia pozycji rotacji bazowej.

## 4. `WeekendDayTemplate`

Pola źródłowe:

* `id`,
* `weekendRotationVariantId`,
* `dayOfWeek`.

`dayOfWeek`:

* `SATURDAY`,
* `SUNDAY`.

Pola `DERIVED`, jeżeli są materializowane:

* `assignmentTemplateIds`,
* `handoverCount`,
* `totalTemplateMinutes`.

Dla wariantu istnieje dokładnie jeden szablon soboty i jeden niedzieli.

Znormalizowana suma odcinków szablonu musi dokładnie odpowiadać popytowi skutecznego planu danego dnia, bez luki, nakładania i czasu poza popytem. W aktualnej konfiguracji biznesowej bazowy popyt soboty i niedzieli wynosi `[06:00,22:00)`; nie jest to wartość przykładowa.

## 5. `WeekendAssignmentTemplate`

Pola źródłowe:

* `id`,
* `weekendDayTemplateId`,
* `educatorId`,
* `startTime`,
* `endTime`,
* `sequenceNumber`.

`sequenceNumber` jest dodatni, unikalny i ciągły od `1` w szablonie dnia. Odcinek jest zgodny z krokiem 30 minut, trwa co najmniej 120 minut i nie przechodzi przez północ.

`educatorId` wskazuje aktywnego wychowawcę grupy należącej do tej samej wersji co wariant nadrzędny.

Dokładny wzorzec stanowi uporządkowana lista:

`(dayOfWeek, sequenceNumber, educatorId, startTime, endTime)`.

## 6. `WeekendRestRequirementBinding`

Opcjonalne powiązanie audytowe:

* `id`,
* `weekendRotationVariantId`,
* `educatorId`,
* `fromAssignmentTemplateId`,
* `toAssignmentTemplateId`,
* `legalRulesConfigurationId`,
* `ruleId`,
* `requiredRestMinutes` (`DERIVED`).

Nie jest drugim źródłem definicji odpoczynku. Autorytatywne są `LegalRulesConfiguration`, rzeczywisty harmonogram oraz oś czasu wynikająca z `timeZoneId`.

Dla audytowego powiązania sobota → niedziela `fromAssignmentTemplateId` i `toAssignmentTemplateId` muszą wskazywać tę samą osobę. Odpoczynki piątek → sobota i niedziela → poniedziałek są obliczane z rzeczywistego harmonogramu, ponieważ nie są w całości wyznaczane przez szablon weekendu.

---

# VIII. GENEROWANIE I HARMONOGRAM

## 1. `GenerationRun`

Pola:

* `id`,
* `configurationVersionId`,
* `startedAt`,
* `finishedAt`,
* `status`,
* `solverName`,
* `solverVersion`,
* `randomSeed`,
* `timeLimitSeconds`,
* `requestedOperationMode`,
* `afternoonPenalty` (`DERIVED`),
* `weekendPenalty` (`DERIVED`),
* `splitDaysPenalty` (`DERIVED`),
* `longSegmentsPenalty` (`DERIVED`),
* `preferredUnavailabilityPenalty` (`DERIVED`),
* `objectiveScore` (`DERIVED`),
* `examinedSolutionsCount` (`DERIVED`),
* `failureReason`.

Statusy:

* `NOT_STARTED`,
* `RUNNING`,
* `CANDIDATE_FOUND`,
* `NO_SOLUTION`,
* `TIME_LIMIT`,
* `INTERNAL_ERROR`.

`requestedOperationMode`:

* `PRODUCTION`,
* `DEMONSTRATION`.

`objectiveScore` jest wyliczane jako:

`wA × P_afternoon + wW × P_weekend + wS × P_splitDays + wL × P_longSegments + wU × P_preferredUnavailable`.

Pola kar przechowują składniki:

* `P_afternoon = Σ |handoverMinute - preferredAfternoonHandoverMinute| / timeStepMinutes`;
* `P_weekend = Σ |assignedMinutes - preferredWeekendSplitMinutes| / timeStepMinutes`, osobno dla obu osób i obu dni;
* `P_splitDays = Σ max(0, segmentCount(educator, date) - 1)`;
* `P_longSegments = Σ max(0, durationMinutes - preferredMaximumSegmentMinutes) / timeStepMinutes`;
* `P_preferredUnavailable` = liczba przypisanych slotów przecinających znormalizowane `PREFERRED` po dominacji `HARD`.

Brak roboczego ciągłego popytu obejmującego godzinę preferowaną albo brak przekazania daje `P_afternoon = 0`. `weekendPenalty` nie jest uprawnieniem do zmiany zatwierdzonego wzorca.

Remis rozstrzyga mniejszy wektor pięciu składników, a następnie leksykograficznie mniejsza kanoniczna lista `(date, startTime, endTime, educatorId)`.

Macierz prawna:

| Profil | Tryb | Czy może powstać wynik? |
|---|---|---|
| `VERIFIED` | `PRODUCTION` | `POPRAWNY` |
| `VERIFIED` | `DEMONSTRATION` | `POPRAWNY_TRYB_DEMONSTRACYJNY` |
| `UNVERIFIED` | `PRODUCTION` | `DANE_NIEPOPRAWNE` |
| `UNVERIFIED` | `DEMONSTRATION` | `POPRAWNY_TRYB_DEMONSTRACYJNY` |
| `EXPIRED` | `PRODUCTION` | `DANE_NIEPOPRAWNE` |
| `EXPIRED` | `DEMONSTRATION` | `POPRAWNY_TRYB_DEMONSTRACYJNY` |

## 2. `ScheduleCycle`

Pola:

* `id`,
* `generationRunId`,
* `startDate` (`DERIVED` z wersji konfiguracji),
* `endDate` (`DERIVED`),
* `cycleLengthWeeks` (`DERIVED` z wersji konfiguracji),
* `cycleIsRepeating` (`DERIVED` z wersji konfiguracji),
* `validationStatus` (`DERIVED` z `ValidationReport`).

W pierwszej wersji:

* `cycleLengthWeeks = 6`,
* `cycleIsRepeating = true`.

`validationStatus` przyjmuje wyłącznie `NOT_VALIDATED`, `VALID` albo `INVALID`.

## 3. `ScheduleWeek`

Pola:

* `id`,
* `scheduleCycleId`,
* `weekNumber`,
* `startDate` (`DERIVED` z cyklu i numeru tygodnia),
* `endDate` (`DERIVED` z cyklu i numeru tygodnia),
* `weekendVariantId`.

## 4. `WorkAssignment`

Pola źródłowe:

* `id`,
* `scheduleWeekId`,
* `groupId`,
* `educatorId`,
* `date`,
* `startTime`,
* `endTime`.

Pola pochodne:

* `durationMinutes` (`DERIVED`),
* `segmentIndexInDay` (`DERIVED`).

Dla przydziału weekendowego `segmentIndexInDay` odpowiada `sequenceNumber` dokładnego szablonu po uporządkowaniu odcinków. Walidator nie ufa tej wartości i wyprowadza kolejność ponownie.

Pierwsza wersja nie zawiera `source = MANUAL` ani `locked`.

## 5. `EducatorWeekSummary`

Wszystkie pola są `DERIVED`:

* `assignedMinutes`,
* `requiredMinutes`,
* `workDaysCount`,
* `splitDaysCount`,
* `weekendRole`,
* `longestSegmentMinutes`,
* `minimumDailyRestMinutes`,
* `weeklyRestMinutes`.

Walidator wylicza je niezależnie z przydziałów.

`weekendRole` jest wyłącznie etykietą prezentacyjną. Nie jest źródłem walidacji weekendu.

---

# IX. WALIDACJA I RAPORTY

## 1. `ValidationReport`

Pola:

* `id`,
* `scheduleCycleId`,
* `validatorVersion`,
* `createdAt`,
* `status`,
* `publicResult` (`DERIVED` ze statusu walidacji, solvera i konfiguracji prawnej),
* `legalRulesConfigurationId`,
* `legalProfileStatus` (`DERIVED`),
* `legalProfileVersion` (`DERIVED`),
* `legalProfileRelevantDate` (`DERIVED`: data weryfikacji albo wygaśnięcia),
* `demonstrationUseProhibitedNotice` (`DERIVED`, wymagane dla wyniku demonstracyjnego),
* `errorCount` (`DERIVED`),
* `warningCount` (`DERIVED`),
* `informationCount` (`DERIVED`).

`status`:

* `NOT_VALIDATED`,
* `VALID`,
* `INVALID`.

Dla `POPRAWNY_TRYB_DEMONSTRACYJNY` raport zawsze zawiera komunikat o braku dopuszczenia do rzeczywistego użycia, status i wersję profilu oraz datę weryfikacji albo wygaśnięcia.

## 2. `ValidationMessage`

Pola:

* `id`,
* `validationReportId`,
* `severity`,
* `ruleId`,
* `educatorId`,
* `groupId`,
* `date`,
* `startTime`,
* `endTime`,
* `message`,
* `requiredValue`,
* `actualValue`,
* `context`.

`severity`:

* `ERROR`,
* `WARNING`,
* `INFO`.

## 3. `ConflictReport`

Pola:

* `id`,
* `generationRunId`,
* `summary`,
* `conflictAnalysisQuality`,
* `conflictingRuleIds`,
* `educatorIds`,
* `dates`,
* `timeIntervals`,
* `requiredValues`,
* `actualValues`,
* `inputFieldsToReview`.

`conflictAnalysisQuality`:

* `EXACT`,
* `INCLUSION_MINIMAL`,
* `APPROXIMATE`.

## 4. Publiczny wynik

Dozwolone wartości:

* `DANE_NIEPOPRAWNE`,
* `BRAK_ROZWIAZANIA`,
* `NIE_ZAKONCZONO_WYSZUKIWANIA`,
* `BLAD_WEWNETRZNY`,
* `POPRAWNY`,
* `POPRAWNY_TRYB_DEMONSTRACYJNY`.

---

# X. ZASADY INTEGRALNOŚCI

1. Wszystkie identyfikatory są unikalne.
2. Każde dziecko wskazuje istniejącego rodzica.
3. Tablice dzieci są widokami `DERIVED`, nie źródłami prawdy.
4. Dla wersji istnieje dokładnie jedna konfiguracja organizacyjna i jeden wybrany profil prawny.
5. V1 zawiera dokładnie jedną aktywną grupę i dokładnie trzech aktywnych wychowawców tej grupy.
6. Grupa, wychowawcy, plany, popyt, warianty weekendowe, przebieg i harmonogram należą do tej samej wersji.
7. Każdy override wskazuje wychowawcę z grupy tej samej wersji.
8. `groupId` przedziału planu jest równy `groupId` planu.
9. `groupId` przydziału jest równy grupie wychowawcy i harmonogramu.
10. Każdy plan dnia jest kompletny.
11. Dla klucza istnieje najwyżej jeden zatwierdzony plan, a dla daty dokładnie jeden skuteczny plan.
12. Obie listy przedziałów są normalizowane jako zbiory.
13. Okres bez opieki należy w całości do sumy godzin funkcjonowania.
14. Przedziały nie przechodzą przez północ, a granice są zgodne z 30 minutami.
15. `cycleStartDate` przypada w poniedziałek, `weekStartDay = MONDAY`, a `timeZoneId` jest wymagane.
16. Przydziały godzin są wielokrotnością 30 minut.
17. Dla wychowawcy i tygodnia istnieje najwyżej jeden zatwierdzony override.
18. Suma obowiązujących przydziałów równa się popytowi tygodnia przed solverem.
19. `requiredStaffCount = 1` jest `DERIVED`, nie wejściowe.
20. Globalna liczba dni wynosi 5.
21. Wersja ma dokładnie sześć zatwierdzonych wariantów weekendowych `BASE`.
22. Każdy wariant ma jeden szablon soboty i jeden niedzieli.
23. Zbiory osób wyprowadzone z obu szablonów dnia są tą samą parą; `offEducatorId` nie ma żadnego odcinka, a on i dwaj pracujący są różni i razem tworzą zbiór trzech aktywnych wychowawców.
24. Wszyscy wychowawcy użyci w szablonie należą do grupy i wersji wariantu.
25. `ScheduleWeek.weekendVariantId` wskazuje zatwierdzony `BASE` tej samej wersji i oczekiwanej pozycji albo jedyny zatwierdzony `SUBSTITUTE`, który zastępuje właśnie ten wariant bez zmiany pozycji.
26. Wymagany `SUBSTITUTE` jest dokładnie jeden, zatwierdzony i dotyczy dat weekendu tej samej wersji.
27. Relacja pomiędzy różnymi wersjami albo grupami powoduje `INVALID_INPUT`.
28. Każdy wynik wskazuje wersję konfiguracji przez relację rodzicielską.
29. Walidator przelicza pola `DERIVED`; rozbieżność modułu powoduje `INTERNAL_ERROR`.
30. Produkcja wymaga `VERIFIED`; `UNVERIFIED` i `EXPIRED` są dozwolone wyłącznie w jawnym trybie demonstracyjnym.
31. Dane przykładowe nie stają się konfiguracją bez jawnego zapisu.

---

# XI. GRANICE WARSTW

Model nie zależy od:

* interfejsu,
* konkretnego solvera,
* konkretnej bazy danych,
* formatu prezentacji.

Generator otrzymuje konfigurację `VALID_INPUT`.

Walidator otrzymuje:

* surową konfigurację,
* wynik kalkulatora zapotrzebowania,
* kandydata harmonogramu.

Walidator nie ufa pochodnym wartościom generatora.

---

# XII. REJESTR IDENTYFIKATORÓW REGUŁ

Reguły krytyczne:

`REQ-NO-GUESSING-001`, `REQ-SPECIAL-DAY-001`, `REQ-TIME-STEP-001`, `REQ-TIME-SAME-DAY-001`, `REQ-SEGMENT-MIN-001`, `REQ-COVERAGE-001`, `REQ-STAFFING-001`, `REQ-NO-OUTSIDE-001`, `REQ-HOURS-001`, `REQ-DAYS-001`, `REQ-UNAVAILABLE-HARD-001`, `REQ-REST-DAILY-001`, `REQ-REST-WEEKLY-001`, `REQ-WEEKEND-001`, `REQ-ROTATION-001`, `REQ-CROSS-WEEK-001`, `REQ-VALIDATOR-INDEP-001`, `REQ-LEGAL-001`.

Preferencje:

`REQ-PREF-AFTERNOON-001`, `REQ-PREF-WEEKEND-SPLIT-001`, `REQ-PREF-SPLIT-DAYS-001`, `REQ-PREF-LONG-SEGMENT-001`, `REQ-PREF-UNAVAILABLE-001`.
