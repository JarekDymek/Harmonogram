# DOPRECYZOWANIA V2

## 1. Cel i status dokumentu

Dokument przedstawia jednoznaczne rozwiązania problemów `V2-P-001`–`V2-P-011` wykazanych w `RAPORT_SPOJNOSCI_V2.md`.

Jest to dokument doprecyzowujący przeznaczony do późniejszego włączenia do aktywnej dokumentacji projektu. Na tym etapie:

* nie zmienia `DECYZJE_PROJEKTOWE.md` ani pozostałych dokumentów źródłowych,
* nie rozpoczyna implementacji,
* nie wybiera technologii ani solvera,
* nie ustala samodzielnie wartości wynikających z prawa.

Do czasu przeniesienia poniższych rozstrzygnięć do dokumentów źródłowych problemy `V2-P-*` należy traktować jako posiadające jednoznaczną propozycję rozwiązania, ale jeszcze nie jako formalnie usunięte z całej dokumentacji.

---

# I. ZASADY NADRZĘDNE

## 1. Model trzyosobowy

Pierwsza wersja nadal obejmuje:

* jedną grupę wychowawczą,
* dokładnie trzech podstawowych wychowawców,
* dokładnie jednego wychowawcę w każdym wymaganym slocie,
* dwóch wychowawców wskazanych do obsługi weekendu,
* trzeciego wychowawcę mającego wolny weekend zgodnie z zatwierdzonym wariantem,
* pełny, kołowy cykl sześciu tygodni.

Nie dodaje się:

* czwartego wychowawcy,
* wychowawcy rezerwowego,
* puli międzygrupowej,
* podwójnej obsady,
* automatycznego zastępstwa tworzonego przez generator.

## 2. Rzeczywiste zasady weekendowe

Dokładne godziny i kolejność pracy weekendowej zatwierdzone przez użytkownika są regułą biznesową placówki. Nie są przykładem, wartością proponowaną przez Codexa ani parametrem, który solver może swobodnie optymalizować.

Opisany przez użytkownika bazowy przedział wymaganej opieki:

* sobota: `[06:00,22:00)`,
* niedziela: `[06:00,22:00)`

należy zachować jako rzeczywistą regułę organizacyjną aktualnego wzorca weekendowego. Musi on być jawnie zapisany w zatwierdzonych danych; nie jest ukrytą wartością domyślną.

Dokładne godziny poszczególnych odcinków, osoba wykonująca każdy odcinek i kolejność odcinków wynikają wyłącznie z zatwierdzonego wzorca danego wariantu. Nie wolno z góry zakładać:

* jednej wspólnej godziny przekazania dla soboty i niedzieli,
* godziny przekazania równej `14:00`,
* tej samej kolejności osób w oba dni,
* odwrócenia kolejności między dniami,
* zakazu odwrócenia kolejności między dniami.

Jeżeli zatwierdzony wzorzec zawiera którąś z tych cech, jest ona egzekwowana dlatego, że występuje w dokładnym wzorcu, a nie dlatego, że została wywnioskowana z nazw `RANO` albo `PO_POLUDNIU`.

## 3. Rozdzielenie reguł organizacyjnych i prawnych

Wzorzec weekendowy opisuje zatwierdzoną organizację pracy placówki.

`LegalRulesConfiguration` opisuje osobno:

* parametry prawne,
* sposób liczenia odpoczynków i innych limitów,
* źródła tych parametrów,
* okres obowiązywania,
* wersję,
* status weryfikacji,
* osobę albo rolę zatwierdzającą.

Aplikacja nie tworzy własnej interpretacji Karty Nauczyciela i nie oznacza wzorca weekendowego jako zgodnego albo niezgodnego z prawem na podstawie wiedzy Codexa. Sprawdza harmonogram wyłącznie według wartości i struktury zapisanych w wybranym profilu prawnym.

Produkcja wymaga profilu `VERIFIED`. Do czasu zatwierdzenia profilu dopuszczalny jest wyłącznie jawny tryb demonstracyjny.

---

# II. ROZWIĄZANIA `V2-P-001`–`V2-P-011`

## `DV2-001` – Jednoznaczny wybór planu dnia

Rozwiązanie problemu `V2-P-001`:

1. Dla jednej wersji konfiguracji i jednej grupy istnieje dokładnie jeden zatwierdzony plan `BASE_WEEKLY` dla każdego dnia tygodnia.
2. Dla klucza `CYCLE_WEEK` może istnieć zero albo jeden zatwierdzony plan.
3. Dla klucza `SPECIFIC_DATE` może istnieć zero albo jeden zatwierdzony plan.
4. Dla każdej z 42 dat hierarchia musi wskazać dokładnie jeden skuteczny plan.
5. Dwa zatwierdzone plany o tym samym kluczu powodują `INVALID_INPUT` oraz `DANE_NIEPOPRAWNE`.
6. Generator, kalkulator i walidator nie używają kolejności rekordów ani pojęcia „pierwszy znaleziony plan”.

Klucze unikalności:

| Zakres | Klucz zatwierdzonego planu |
|---|---|
| `BASE_WEEKLY` | `configurationVersionId`, `groupId`, `scope`, `dayOfWeek` |
| `CYCLE_WEEK` | `configurationVersionId`, `groupId`, `scope`, `weekNumber`, `dayOfWeek` |
| `SPECIFIC_DATE` | `configurationVersionId`, `groupId`, `scope`, `date` |

Rekordy robocze mogą współistnieć, ale tylko jeden rekord danego klucza może być zatwierdzony. Brak skutecznego planu dla choć jednej daty powoduje `INVALID_INPUT` z `ruleId = REQ-SPECIAL-DAY-001`.

## `DV2-002` – Poniedziałek jako kotwica cyklu

Rozwiązanie problemu `V2-P-002`:

* `cycleStartDate` musi przypadać w poniedziałek,
* `weekStartDay` ma w V1 jedyną dozwoloną wartość `MONDAY`,
* tydzień `n` zaczyna się w dacie `cycleStartDate + 7 × (n - 1) dni`,
* tydzień trwa od poniedziałku do niedzieli,
* weekend tygodnia `n` stanowią jego szósta i siódma data,
* niezgodna data startowa powoduje `INVALID_INPUT` z `ruleId = REQ-CROSS-WEEK-001`.

Pozycja wariantu weekendowego dla tygodnia `n` wynosi:

`1 + ((startingWeekendVariant - 1 + n - 1) mod 6)`

Ta sama reguła obowiązuje po zawinięciu tygodnia 6 do tygodnia 1.

## `DV2-003` – Strefa czasu projektu

Rozwiązanie problemu `V2-P-003`:

* projekt posiada jawne pole `timeZoneId`,
* domyślną, widocznie wstępnie wybraną wartością jest `Europe/Warsaw`,
* wartość jest zapisywana w `ScheduleConfigurationVersion`,
* brak strefy jest błędem wejścia; generator nie może uzupełnić jej niewidocznie,
* lokalna data i `HH:MM` są przeliczane na oś czasu przy użyciu zapisanej strefy IANA,
* długość odpoczynku oznacza rzeczywistą liczbę minut pomiędzy chwilami na osi czasu, a nie wyłącznie różnicę wskazań zegara,
* nieistniejąca albo niejednoznaczna lokalna granica czasu powoduje w V1 `INVALID_INPUT`, zamiast automatycznego wyboru przesunięcia,
* generator i niezależny walidator wykonują własną konwersję według tej samej jawnej specyfikacji.

Testy czasu muszą objąć przejście na czas letni i zimowy w `Europe/Warsaw`, w tym odpoczynek przecinający zmianę czasu.

## `DV2-004` – Dokładny weekendowy wzorzec godzinowy

Rozwiązanie problemu `V2-P-004` nie zmienia organizacji weekendów. Zastępuje niepełną interpretację ról dokładnym, zatwierdzonym wzorcem przydziałów.

### 1. Znaczenie wzorca

Dla każdego wariantu przechowuje się:

* pozycję w sześciotygodniowym cyklu,
* wychowawcę mającego wolny cały weekend,
* zbiór dwóch wychowawców pracujących,
* osobny szablon soboty i niedzieli,
* dokładną listę odcinków każdego dnia,
* wychowawcę, początek, koniec i kolejność każdego odcinka,
* liczbę przekazań opieki każdego dnia,
* powiązanie z profilem określającym wymagany odpoczynek,
* zatwierdzenie i jego referencję.

Role `RANO`, `PO_POLUDNIU` i `WOLNE` mogą pozostać wyłącznie jako etykiety prezentacyjne `DERIVED`. Nie są źródłem walidacji.

### 2. Dopasowanie dokładne

Po podstawieniu właściwych dat rzeczywisty weekend odpowiada wzorcowi tylko wtedy, gdy uporządkowane listy krotek są identyczne:

`(dayOfWeek, sequenceNumber, educatorId, startTime, endTime)`

Nie stosuje się tolerancji czasu, automatycznego scalania rzeczywistych przydziałów ani zamiany osób o równych długościach odcinków.

### 3. Przekazanie opieki

Przekazaniem jest granica dwóch kolejnych odcinków tego samego ciągłego przedziału zapotrzebowania, gdy:

* koniec wcześniejszego odcinka jest równy początkowi późniejszego,
* wychowawcy są różni.

Przerwa w zapotrzebowaniu nie jest przekazaniem. `handoverCount` jest wartością `DERIVED` z uporządkowanych szablonów i musi zgadzać się z materializowaną wartością, jeżeli jest przechowywana.

### 4. Generator

Generator:

* przypisuje wariant wynikający z pozycji cyklu,
* traktuje wszystkie weekendowe krotki jako ustalone dane, a nie zmienne do optymalizacji,
* nie zmienia osoby, kolejności, początku ani końca odcinka,
* nie używa preferencji `8 + 8` do zmiany zatwierdzonego wzorca,
* sprawdza wpływ ustalonego weekendu na godziny, pięć dni pracy, niedostępności i odpoczynki.

Jeżeli ustalony wzorzec pozostaje w konflikcie z inną regułą krytyczną, generator nie poprawia go samodzielnie. Zależnie od etapu wykrycia zwraca `INVALID_INPUT` albo udowodniony `NO_SOLUTION` wraz z raportem konfliktu.

## `DV2-005` – Strukturalny odpoczynek tygodniowy

Rozwiązanie problemu `V2-P-005` polega na przechowywaniu kompletnej metody liczenia w wersjonowanym profilu prawnym. Aplikacja nie wybiera tej metody samodzielnie.

`LegalRulesConfiguration` wymaga następujących danych:

* `weeklyRestWindowType`: `FIXED_LOCAL_WEEK` albo `ROLLING_DURATION`,
* `weeklyRestWindowLengthMinutes`,
* `weeklyRestWindowStepMinutes`,
* `weeklyRestAnchorDayOfWeek`,
* `weeklyRestAnchorTime`,
* `minimumWeeklyRestMinutes`,
* `weeklyRestAttributionMode`: `FULLY_CONTAINED` albo `INTERSECTION_WITH_WINDOW`,
* `weeklyRestReuseAcrossWindowsAllowed`,
* `weeklyRestExceptionEnabled`,
* `weeklyRestExceptionMinimumMinutes`,
* `weeklyRestExceptionMaximumOccurrencesPerCycle`,
* `weeklyRestExceptionMinimumGapMinutes`,
* `weeklyRestCompensationRequired`,
* `weeklyRestCompensationMinutes`,
* `weeklyRestCompensationDeadlineMinutes`.

Pola nieużywane przez wybrany typ albo wyłączony wyjątek muszą być jawnie puste. W profilu `VERIFIED` wybrana kombinacja i wszystkie wartości muszą być objęte śladem zatwierdzenia prawnego.

Algorytm kontroli:

1. buduje kołową listę maksymalnych nieprzerwanych okresów bez pracy na osi czasu,
2. buduje wszystkie okna wymagane przez wybrany `weeklyRestWindowType`,
3. dla każdego okna oblicza kwalifikujący się odpoczynek według `weeklyRestAttributionMode`,
4. stosuje regułę ponownego użycia odpoczynku zgodnie z polem profilu,
5. wymaga co najmniej `minimumWeeklyRestMinutes`,
6. wyjątek stosuje wyłącznie w zakresie, liczbie i odstępach zapisanych w profilu,
7. sprawdza wymaganą kompensację,
8. powtarza obliczenie na granicy tydzień 6 → tydzień 1.

Do czasu zewnętrznego zatwierdzenia struktury i wartości profil może mieć status `UNVERIFIED` albo `EXPIRED` i służyć wyłącznie do jawnej demonstracji.

## `DV2-006` – Poziomy testów

Rozwiązanie problemu `V2-P-006`:

| `testLevel` | Zakres | Dozwolony oczekiwany status |
|---|---|---|
| `INPUT_VALIDATION` | kompletność i spójność danych przed solverem | `VALID_INPUT`, `INVALID_INPUT` |
| `CALCULATOR_UNIT` | kalkulator zapotrzebowania albo czasu | `CALCULATION_OK`, `INTERNAL_ERROR` |
| `RULE_VALIDATOR_UNIT` | jedna reguła na kompletnym fixture komponentu | `RULE_SATISFIED`, `RULE_VIOLATED` |
| `SOLVER_INTEGRATION` | solver, kalkulator i walidator na pełnych danych wejścia | status `GenerationRun` |
| `END_TO_END` | pełna operacja i `ValidationReport` | publiczny wynik operacji oraz `VALID` albo `INVALID` |

Statusów `VALID` i `INVALID` nie używa się do opisania pojedynczego przedziału bez pełnego `ValidationReport`.

Każdy test określa:

* `testLevel`,
* nazwany, kompletny fixture właściwy dla poziomu,
* pełną zmianę względem tego fixture, jeżeli występuje,
* oczekiwany status,
* oczekiwane `ruleId` albo jawne „brak naruszenia”,
* wartość wymaganą i faktyczną.

Fixture komponentowy jest kompletny dla wejść badanej funkcji. Fixture `SOLVER_INTEGRATION` i `END_TO_END` musi zawierać pełną konfigurację 42 dat i pełny kandydat albo jednoznaczny oczekiwany wynik solvera.

## `DV2-007` – Błąd pola pochodnego

Rozwiązanie problemu `V2-P-007`:

* `requiredStaffCount` nie należy do surowych danych użytkownika,
* kalkulator wyprowadza je wyłącznie z reguły V1 i zawsze ustawia `1`,
* wartość inna niż `1` w `CalculatedCareRequirement` oznacza wadliwy wynik modułu,
* rozbieżność wykryta przez walidator powoduje `INTERNAL_ERROR`,
* publiczny wynik brzmi `BLAD_WEWNETRZNY`,
* `ruleId` wynosi `REQ-VALIDATOR-INDEP-001`, a kontekst wskazuje również `REQ-STAFFING-001`.

`INVALID_INPUT` pozostaje właściwe dla błędnych surowych danych. Nie wolno używać go do obarczania użytkownika błędem obliczonego pola `DERIVED`.

## `DV2-008` – Normalizacja przedziałów

Rozwiązanie problemu `V2-P-008`:

1. Przedziały funkcjonowania są traktowane jako zbiór czasu.
2. Nakładające się i stykające przedziały są scalane do posortowanej, rozłącznej listy kanonicznej.
3. Przedziały bez wymaganej opieki są normalizowane w taki sam sposób.
4. Przedział bez wymaganej opieki musi w całości należeć do sumy godzin funkcjonowania; przekroczenie powoduje `INVALID_INPUT`.
5. Zapotrzebowanie jest różnicą zbiorów:

   `union(operatingIntervals) \ union(noCareIntervals)`

6. Minuty części wspólnej nie są nigdy liczone podwójnie.
7. Kalkulator i niezależny walidator wykonują normalizację osobno.
8. Metadane rekordów źródłowych nie giną; przedział kanoniczny może przechowywać `DERIVED` listę identyfikatorów źródłowych.

Testy obejmują przedziały rozłączne, stykające, częściowo nakładające się i całkowicie zawarte.

## `DV2-009` – Kompletna funkcja celu

Rozwiązanie problemu `V2-P-009` używa kroku 30 minut. Wszystkie składniki są nieujemnymi liczbami całkowitymi.

### 1. Podział popołudnia

Dla daty od poniedziałku do piątku:

* uwzględnia się maksymalny ciągły przedział zapotrzebowania zawierający `preferredAfternoonHandoverTime`,
* jeżeli wskazana godzina nie należy do zapotrzebowania, kara tej daty wynosi `0`,
* jeżeli przedział nie jest dzielony między wychowawców, kara wynosi `0`,
* dla każdego rzeczywistego przekazania w tym przedziale nalicza się odległość od godziny preferowanej.

`P_afternoon = Σ |handoverMinute - preferredAfternoonHandoverMinute| / timeStepMinutes`

### 2. Podział weekendu

Dla każdego dnia weekendowego i każdego z dwóch pracujących wychowawców:

`P_weekend = Σ |assignedMinutes - preferredWeekendSplitMinutes| / timeStepMinutes`

Kara jest sumowana osobno dla soboty i niedzieli. Dla podziału `480 + 480` wynosi `0`.

Zatwierdzony wzorzec weekendowy pozostaje regułą krytyczną. `P_weekend`:

* służy do raportowania jakości zatwierdzonego wzorca albo
* może porównywać kilka jawnie zatwierdzonych wariantów zastępczych, jeżeli wszystkie są dopuszczone dla tej samej daty.

Nie może upoważniać generatora do zmiany dokładnych godzin wzorca.

### 3. Dni dzielone

`P_splitDays = Σ max(0, segmentCount(educator, date) - 1)`

### 4. Długie odcinki

`P_longSegments = Σ max(0, durationMinutes - preferredMaximumSegmentMinutes) / timeStepMinutes`

### 5. Niedostępność `PREFERRED`

`P_preferredUnavailable` jest liczbą przypisanych slotów przecinających znormalizowaną niedostępność `PREFERRED`, po zastosowaniu dominacji `HARD`.

### 6. Wynik łączny

`objectiveScore = wA × P_afternoon + wW × P_weekend + wS × P_splitDays + wL × P_longSegments + wU × P_preferredUnavailable`

Wagi są jawnymi, nieujemnymi liczbami całkowitymi w zatwierdzonej konfiguracji organizacyjnej.

Remis rozstrzyga się kolejno przez:

1. mniejszy wektor `(P_afternoon, P_weekend, P_splitDays, P_longSegments, P_preferredUnavailable)`,
2. leksykograficzne porównanie kanonicznej listy krotek `(date, startTime, endTime, educatorId)`.

## `DV2-010` – Integralność wersji i grupy

Rozwiązanie problemu `V2-P-010`:

* wersja konfiguracji ma dokładnie jedną konfigurację organizacyjną i dokładnie jeden wybrany profil prawny,
* grupa, plany, popyt, warianty weekendowe, uruchomienie generatora i harmonogram należą do tej samej wersji,
* V1 ma dokładnie jedną aktywną grupę i dokładnie trzech aktywnych wychowawców tej grupy,
* każdy `EducatorWeekAssignmentOverride` wskazuje wychowawcę z grupy należącej do tej samej wersji,
* `groupId` każdego przedziału planu jest równy `groupId` jego planu,
* `groupId` każdego `WorkAssignment` jest równy grupie wskazanego wychowawcy i grupie harmonogramu,
* każdy wychowawca wariantu weekendowego należy do tej samej grupy i wersji,
* `offEducatorId` oraz dwa identyfikatory pracujących są różne i razem tworzą dokładnie zbiór trzech aktywnych wychowawców,
* `ScheduleWeek.weekendVariantId` wskazuje zatwierdzony wariant tej samej wersji i oczekiwanej pozycji cyklu,
* relacje pomiędzy wersjami albo grupami powodują `INVALID_INPUT`.

Referencja dziecko → rodzic pozostaje autorytatywna. Tablice dzieci i skrócone identyfikatory na rodzicu są wyłącznie widokami `DERIVED`.

## `DV2-011` – Profil `EXPIRED` w trybie demonstracyjnym

Rozwiązanie problemu `V2-P-011`:

| `verificationStatus` | `requestedOperationMode` | Czy solver może wystartować? | Wynik po poprawnej walidacji |
|---|---|---:|---|
| `VERIFIED` | `PRODUCTION` | tak | `POPRAWNY` |
| `VERIFIED` | `DEMONSTRATION` | tak | `POPRAWNY_TRYB_DEMONSTRACYJNY` |
| `UNVERIFIED` | `PRODUCTION` | nie | `DANE_NIEPOPRAWNE` |
| `UNVERIFIED` | `DEMONSTRATION` | tak | `POPRAWNY_TRYB_DEMONSTRACYJNY` |
| `EXPIRED` | `PRODUCTION` | nie | `DANE_NIEPOPRAWNE` |
| `EXPIRED` | `DEMONSTRATION` | tak | `POPRAWNY_TRYB_DEMONSTRACYJNY` |

Każdy wynik demonstracyjny zawiera widoczne oznaczenie:

* braku dopuszczenia do rzeczywistego użycia,
* statusu profilu,
* jego wersji,
* daty weryfikacji albo wygaśnięcia.

`EXPIRED` nigdy nie pozwala na wynik `POPRAWNY`.

---

# III. MODEL DANYCH WEEKENDU

## 1. `WeekendRotationVariant`

Pola źródłowe:

* `id`,
* `configurationVersionId`,
* `variantKind`: `BASE` albo `SUBSTITUTE`,
* `positionInCycle` – wymagane dla `BASE`, puste dla `SUBSTITUTE`,
* `replacesWeekendRotationVariantId` – wymagane dla `SUBSTITUTE`,
* `applicableWeekNumber` – wymagane dla `SUBSTITUTE`,
* `applicableSaturdayDate` – wymagane dla `SUBSTITUTE`,
* `applicableSundayDate` – wymagane dla `SUBSTITUTE`,
* `offEducatorId`,
* `approved`,
* `approvalReference`,
* `approvedAt`,
* `approvedBy`.

Pola widokowe `DERIVED`:

* `workingEducatorIds`,
* `saturdayTemplateId`,
* `sundayTemplateId`.

`workingEducatorIds` jest wyprowadzane z dzieci `WeekendAssignmentTemplate`. `saturdayTemplateId` i `sundayTemplateId` są wyprowadzane z dzieci `WeekendDayTemplate`. Nie są równoległym źródłem prawdy.

Dla każdej wersji istnieje dokładnie sześć zatwierdzonych wariantów `BASE` o unikalnych pozycjach 1–6. Warianty `SUBSTITUTE` nie zmieniają pozycji ani kolejności sześciotygodniowej rotacji.

## 2. `WeekendDayTemplate`

Pola źródłowe:

* `id`,
* `weekendRotationVariantId`,
* `dayOfWeek`: wyłącznie `SATURDAY` albo `SUNDAY`.

Pola `DERIVED`:

* `assignmentTemplateIds`,
* `handoverCount`,
* `totalTemplateMinutes`.

Dla wariantu istnieje dokładnie jeden szablon soboty i dokładnie jeden szablon niedzieli.

## 3. `WeekendAssignmentTemplate`

Pola:

* `id`,
* `weekendDayTemplateId`,
* `educatorId`,
* `startTime`,
* `endTime`,
* `sequenceNumber`.

Warunki:

* `sequenceNumber` jest dodatni i unikalny w obrębie dnia,
* kolejność numerów jest ciągła od `1`,
* granice są zgodne z krokiem 30 minut,
* odcinek ma co najmniej 120 minut,
* odcinek nie przechodzi przez północ,
* wychowawca należy do grupy i wersji wariantu.

## 4. `WeekendRestRequirementBinding`

Encja nie duplikuje własnej interpretacji prawnej. Łączy wzorzec z regułą wybranego profilu.

Pola:

* `id`,
* `weekendRotationVariantId`,
* `educatorId`,
* `fromAssignmentTemplateId`,
* `toAssignmentTemplateId`,
* `legalRulesConfigurationId`,
* `ruleId`,
* `requiredRestMinutes` (`DERIVED` jako migawka wartości profilu).

Dla przejścia sobota → niedziela przypisania obu stron dotyczą tej samej osoby. Odpoczynek piątek → sobota i niedziela → poniedziałek jest sprawdzany z rzeczywistego harmonogramu, ponieważ jego drugi odcinek nie należy w całości do weekendowego szablonu.

---

# IV. WALIDACJA WEEKENDU

Walidator wykonuje poniższe kontrole niezależnie od generatora.

## 1. Wybór wzorca

1. Wyznacza bazową pozycję wariantu z numeru tygodnia i `startingWeekendVariant`.
2. Wybiera dokładnie jeden zatwierdzony wariant `BASE`.
3. Jeżeli dla danego weekendu istnieje zatwierdzony wariant `SUBSTITUTE`, wymaga dokładnie jednego i stosuje go zamiast bazowego.
4. Brak, duplikat albo niezatwierdzony wymagany wzorzec powoduje `INVALID_INPUT`.

## 2. Para i osoba wolna

Walidator:

* wyprowadza zbiór pracujących z dokładnych odcinków obu dni,
* wymaga dokładnie dwóch różnych wychowawców,
* wymaga zgodności tego zbioru z `workingEducatorIds` `DERIVED`,
* wymaga braku jakiegokolwiek przydziału `offEducatorId` w sobotę i niedzielę,
* nie tworzy założeń o kolejności osób pomiędzy dniami.

Naruszenie ma `ruleId = REQ-WEEKEND-001`.

## 3. Pokrycie i pojedyncza obsada

Dla każdego slotu walidator porównuje:

* niezależnie obliczone zapotrzebowanie,
* sumę rzeczywistych przydziałów.

Wymagane:

* w zapotrzebowaniu dokładnie jedna osoba,
* poza zapotrzebowaniem zero osób.

Luka narusza `REQ-COVERAGE-001`. Nakładanie narusza `REQ-STAFFING-001`. Praca poza popytem narusza `REQ-NO-OUTSIDE-001`.

## 4. Czas i odcinki

Każdy rzeczywisty i szablonowy odcinek jest sprawdzany według:

* `REQ-TIME-STEP-001`,
* `REQ-TIME-SAME-DAY-001`,
* `REQ-SEGMENT-MIN-001`.

## 5. Odpoczynek

Walidator oblicza rzeczywisty czas odpoczynku na osi czasu `Europe/Warsaw` i stosuje wyłącznie wymagania wybranego profilu prawnego.

Sprawdza co najmniej:

* piątek → sobota,
* wszystkie przejścia sobota → niedziela dla każdej osoby,
* niedziela → poniedziałek,
* odpoczynek tygodniowy,
* przejście weekendu tygodnia 6 do tygodnia 1 następnego cyklu.

Naruszenia używają `REQ-REST-DAILY-001`, `REQ-REST-WEEKLY-001` albo `REQ-CROSS-WEEK-001`.

## 6. Dokładne dopasowanie wzorca

Walidator sortuje szablon i rzeczywiste przydziały według dnia i `sequenceNumber`, a następnie porównuje wszystkie krotki.

Każda różnica osoby, początku, końca, kolejności albo liczby odcinków narusza `REQ-WEEKEND-001`, nawet jeżeli pokrycie i liczba minut pozostają poprawne.

Walidacja nie opiera się na etykietach `RANO` ani `PO_POLUDNIU`.

## 7. Pełna rotacja

Walidator wymaga w kolejnych tygodniach dokładnych wariantów pozycji 1–6, z uwzględnieniem przesunięcia startowego i zawinięcia cyklu.

Sprawdza:

* dokładny wariant każdego tygodnia,
* dwa wolne weekendy każdego wychowawcy,
* dwa wspólne weekendy każdej pary,
* zgodność dokładnych szablonów z zatwierdzonymi pozycjami,
* przejście wariantu 6 → wariant 1.

Nie wyprowadza odwrócenia ani braku odwrócenia z nazw ról. Oczekiwana kolejność znajduje się w dokładnym szablonie wariantu.

---

# V. DZIEŃ SPECJALNY W WEEKEND

## 1. Zasada

Kompletny plan `SPECIFIC_DATE` nadal może zmienić rzeczywiste zapotrzebowanie soboty albo niedzieli. Nie upoważnia to generatora do zmiany wzorca.

Przed uruchomieniem solvera walidacja wejścia:

1. oblicza zapotrzebowanie dnia specjalnego,
2. porównuje je z dokładnym bazowym wzorcem weekendowym,
3. sprawdza pokrycie, pojedynczą obsadę i zakaz pracy poza popytem,
4. jeżeli bazowy wzorzec pozostaje dokładnie zgodny, zachowuje go bez zmian,
5. jeżeli nie jest zgodny, wymaga jednego jawnego, zatwierdzonego wariantu `SUBSTITUTE`,
6. ponownie sprawdza wariant zastępczy według wszystkich reguł krytycznych.

Brak wymaganego wariantu zastępczego powoduje:

* `INVALID_INPUT`,
* publiczny wynik `DANE_NIEPOPRAWNE`,
* `ruleId = REQ-SPECIAL-DAY-001`,
* kontekst wskazujący również bazowy `REQ-WEEKEND-001`,
* brak uruchomienia solvera.

Wariant zastępczy:

* jest wprowadzany przez użytkownika,
* zawiera pełny szablon obu dni weekendu,
* ma zatwierdzenie i referencję,
* nie zmienia pozycji rotacji bazowej,
* nie jest tworzony, sugerowany ani poprawiany przez generator.

---

# VI. PROPOZYCJE TESTÓW WEEKENDOWYCH

## 1. Kompletny fixture komponentowy `FIX-V2-WEEKEND-APPROVED`

Fixture jest kompletnym wejściem dla weekendowego walidatora reguł. Dane prawne są wyłącznie testowe.

* wersja `CV-TEST-01`,
* grupa `G1`,
* wychowawcy `A`, `B`, `C`,
* `cycleStartDate = 2026-09-14` – poniedziałek,
* `timeZoneId = Europe/Warsaw`,
* `timeStepMinutes = 30`,
* `minimumSegmentMinutes = 120`,
* `startingWeekendVariant = 1`,
* testowy profil prawny `LP-TEST-01`,
* `verificationStatus = UNVERIFIED`,
* `requestedOperationMode = DEMONSTRATION`,
* testowe `minimumDailyRestMinutes = 660`,
* testowe `minimumWeeklyRestMinutes = 2100`,
* `weeklyRestWindowType = FIXED_LOCAL_WEEK`,
* kotwica odpoczynku: poniedziałek `00:00`,
* `weeklyRestAttributionMode = INTERSECTION_WITH_WINDOW`,
* wyjątki odpoczynku wyłączone,
* zapotrzebowanie każdej testowanej soboty i niedzieli: `[06:00,22:00)`,
* dokładnie jedna wymagana osoba w każdym slocie,
* brak niedostępności.

Zatwierdzone testowe warianty `BASE`:

| Pozycja | Pracujący w kolejności szablonu | Wolny |
|---:|---|---|
| 1 | A, B | C |
| 2 | A, C | B |
| 3 | B, C | A |
| 4 | B, A | C |
| 5 | C, A | B |
| 6 | C, B | A |

Dla każdego wariantu w bazowym fixture:

* sobota: pierwsza osoba `[06:00,14:00)`, druga `[14:00,22:00)`,
* niedziela: pierwsza osoba `[06:00,14:00)`, druga `[14:00,22:00)`,
* `sequenceNumber = 1, 2`,
* `handoverCount = 1`,
* `approved = true`,
* `approvalReference = TEST-APPROVAL`.

Godziny szczegółowych podziałów w tym fixture są danymi testowymi. Produkcyjne rekordy muszą kopiować 1:1 dokładne wzorce zatwierdzone przez placówkę i nie mogą być zastąpione tym fixture.

## 2. Kompletny fixture integracyjny `FIX-V2-CYCLE-INTEGRATION`

Fixture stanowi pełną kopię `FIX-CYCLE-VALID` z `TESTY_I_SCENARIUSZE.md` oraz zawiera następujące jawne uzupełnienia:

* `weekStartDay = MONDAY`,
* `timeZoneId = Europe/Warsaw`,
* kompletną testową strukturę odpoczynku tygodniowego opisaną w `FIX-V2-WEEKEND-APPROVED`,
* sześć zatwierdzonych wariantów `WeekendRotationVariant`,
* dla soboty każdego wariantu dokładne szablony `M [06:00,09:00)` i `P [09:00,12:00)`,
* dla niedzieli każdego wariantu dokładne szablony `M [06:00,09:00)` i `P [09:00,12:00)`,
* `sequenceNumber = 1, 2`,
* `handoverCount = 1`,
* brak wariantów `SUBSTITUTE`,
* pełne plany wszystkich 42 dat, przydziały godzin i wszystkie przydziały pracy istniejącego `FIX-CYCLE-VALID`.

Symbole `M`, `P` i `O` są rozwijane według sześciu pozycji zapisanych w tym fixture. Etykiety służą wyłącznie skrótowemu zapisowi fixture; walidator porównuje identyfikatory wychowawców i dokładne krotki czasu.

Jest to kompletny fixture testowy poziomu `SOLVER_INTEGRATION` i `END_TO_END`. Jego godziny nie zastępują produkcyjnego wzorca placówki.

## 3. Scenariusze

Każda zmiana w tabeli tworzy kompletną kopię wskazanego fixture; wszystkie niewymienione pola pozostają identyczne.

| ID | Poziom | Kompletny fixture albo pełna zmiana | Oczekiwany status | Oczekiwany `ruleId` | Wymagane / faktyczne |
|---|---|---|---|---|---|
| `WV2-T-001` | `RULE_VALIDATOR_UNIT` | `FIX-V2-WEEKEND-APPROVED`, pozycja 1; rzeczywiste krotki obu dni identyczne z szablonem | `RULE_SATISFIED` | `REQ-WEEKEND-001` – brak naruszenia | 4 dokładne krotki / 4 identyczne |
| `WV2-T-002` | `RULE_VALIDATOR_UNIT` | kopia pozycji 1; zatwierdzony szablon niedzieli zmieniony na A `[06:00,14:30)`, B `[14:30,22:00)`; rzeczywisty przydział identyczny z tym szablonem | `RULE_SATISFIED` | `REQ-WEEKEND-001` – brak naruszenia | przekazanie sob. 14:00, niedz. 14:30 / zgodne |
| `WV2-T-003A` | `RULE_VALIDATOR_UNIT` | `FIX-V2-WEEKEND-APPROVED`, pozycja 1; A odpoczywa sob. 14:00 → niedz. 06:00, B sob. 22:00 → niedz. 14:00 | `RULE_SATISFIED` | `REQ-REST-DAILY-001` – brak naruszenia | 660 / A 960, B 960 min |
| `WV2-T-003B` | `RULE_VALIDATOR_UNIT` | kopia pozycji 1; zatwierdzony testowy szablon niedzieli ma B `[06:00,14:00)`, A `[14:00,22:00)` | `RULE_VIOLATED` | `REQ-REST-DAILY-001` | 660 / B 480 min |
| `WV2-T-004` | `RULE_VALIDATOR_UNIT` | `FIX-V2-WEEKEND-APPROVED`; rzeczywista sobota A `[06:00,14:00)`, B `[14:30,22:00)` | `RULE_VIOLATED` | `REQ-COVERAGE-001`, `REQ-WEEKEND-001` | obsada 1 i wzorzec 14:00 / obsada 0 w 14:00–14:30, start 14:30 |
| `WV2-T-005` | `RULE_VALIDATOR_UNIT` | `FIX-V2-WEEKEND-APPROVED`; rzeczywista sobota A `[06:00,14:00)`, B `[13:30,22:00)` | `RULE_VIOLATED` | `REQ-STAFFING-001`, `REQ-WEEKEND-001` | obsada 1 i start 14:00 / obsada 2 w 13:30–14:00, start 13:30 |
| `WV2-T-006` | `SOLVER_INTEGRATION` | `FIX-V2-CYCLE-INTEGRATION`; generator sam zamienia w niedzielę tygodnia 1 osoby z odcinków `M [06:00,09:00)` i `P [09:00,12:00)`, pozostawiając pełne pokrycie | `INTERNAL_ERROR`; publicznie `BLAD_WEWNETRZNY` | `REQ-WEEKEND-001` | dokładne osoby w 2 krotkach / 2 osoby zamienione |
| `WV2-T-007` | `INPUT_VALIDATION` | kopia pozycji 1; kompletny `SPECIFIC_DATE` soboty zmienia popyt na `[06:00,22:30)`; brak `SUBSTITUTE` | `INVALID_INPUT` | `REQ-SPECIAL-DAY-001` | pokrycie do 22:30 / wzorzec do 22:00, brak 30 min |
| `WV2-T-008` | `INPUT_VALIDATION` | jak `WV2-T-007`, lecz istnieje jeden zatwierdzony `SUBSTITUTE`: sobota A `[06:00,14:00)`, B `[14:00,22:30)`; niedziela bez zmian | `VALID_INPUT` | `REQ-SPECIAL-DAY-001` – brak naruszenia | dokładne pokrycie do 22:30 / zgodne |
| `WV2-T-009` | `RULE_VALIDATOR_UNIT` | kompletne sześć weekendów `FIX-V2-WEEKEND-APPROVED`, pozycje 1–6 w tej kolejności, następnie pozycja 1 kolejnego cyklu | `RULE_SATISFIED` | `REQ-ROTATION-001` – brak naruszenia | sekwencja 1,2,3,4,5,6,1 / zgodna |

Test `WV2-T-003B` nie stanowi oceny prawnej rzeczywistego wzorca placówki. Jest testem zachowania walidatora względem jawnej, testowej wartości profilu.

---

# VII. ZESTAWIENIE ROZWIĄZAŃ

| Problem | Jednoznaczne rozwiązanie |
|---|---|
| `V2-P-001` | Unikalny zatwierdzony plan na klucz i dokładnie jeden skuteczny plan każdej daty. |
| `V2-P-002` | `cycleStartDate` przypada w poniedziałek; jawne `weekStartDay = MONDAY`. |
| `V2-P-003` | Jawna strefa IANA `Europe/Warsaw`; odpoczynki liczone na osi czasu. |
| `V2-P-004` | Dokładne, zatwierdzone krotki weekendowe zamiast walidacji przez abstrakcyjne role. |
| `V2-P-005` | Kompletna struktura okna, przypisania, wyjątków i kompensacji w profilu prawnym. |
| `V2-P-006` | Pięć poziomów testów z właściwymi statusami i kompletnymi fixture. |
| `V2-P-007` | Błędne `DERIVED requiredStaffCount` powoduje `INTERNAL_ERROR`, nie `INVALID_INPUT`. |
| `V2-P-008` | Normalizacja przez sumę zbiorów; brak podwójnego liczenia. |
| `V2-P-009` | Pełne wzory pięciu kar, wyniku ważonego i rozstrzygania remisów. |
| `V2-P-010` | Złożone reguły spójności wersji, grupy, wychowawców i konfiguracji. |
| `V2-P-011` | `EXPIRED` blokuje produkcję, ale dopuszcza wyraźnie oznaczone demo. |

---

# VIII. POTWIERDZENIA I DALSZE AKTUALIZACJE

## 1. Potwierdzenia

1. Model pozostaje trzyosobowy.
2. Dokładne godziny weekendowe zatwierdzone przez placówkę są zachowywane 1:1 w szablonach i nie mogą być zmieniane przez generator.
3. Bazowy rzeczywisty przedział weekendowej opieki `[06:00,22:00)` w sobotę i niedzielę nie jest traktowany jako przykład Codexa.
4. Nie dodaje się wychowawcy rezerwowego ani puli międzygrupowej.
5. Możliwość stosowania opisanego harmonogramu weekendowego nie jest podważana.
6. Ocena zgodności prawnej należy do zatwierdzonego, wersjonowanego profilu prawnego placówki.

## 2. Dokumenty wymagające późniejszej aktualizacji

Po zatwierdzeniu niniejszych doprecyzowań należy zaktualizować:

* `DECYZJE_PROJEKTOWE.md` – dodać wiążące decyzje odpowiadające `DV2-001`–`DV2-011` i usunąć walidację weekendu opartą wyłącznie na rolach;
* `SPECYFIKACJA.md` – uzupełnić zakres czasu, weekendów, profilu prawnego i statusów;
* `ZASADY.md` – przepisać `REQ-WEEKEND-001`, `REQ-ROTATION-001`, odpoczynki i wzory preferencji;
* `WALIDACJA.md` – dodać dokładne porównanie szablonów, normalizację, strefę czasu i poziomy wyników;
* `DANE_WEJSCIOWE.md` – dodać szablony weekendowe, wariant zastępczy, strefę czasu i pełną strukturę profilu prawnego;
* `ALGORYTM.md` – zamienić weekendowe role decyzyjne na ustalone krotki szablonu i uzupełnić funkcję celu;
* `MODEL_DANYCH.md` – dodać encje i reguły integralności opisane w niniejszym dokumencie;
* `TESTY_I_SCENARIUSZE.md` – wprowadzić poziomy testów, kompletne fixture i scenariusze `WV2-T-*`;
* `CHANGELOG_DOKUMENTACJI.md` – odnotować późniejszą aktualizację dokumentacji;
* nowy raport spójności po aktualizacji – ponownie ocenić usunięcie `V2-P-001`–`V2-P-011`.

Historycznych `RAPORT_SPOJNOSCI.md` i `RAPORT_SPOJNOSCI_V2.md` nie należy modyfikować.

## 3. Ograniczenie bieżącego etapu

W ramach utworzenia tego dokumentu:

* nie zaktualizowano wymienionych dokumentów źródłowych,
* nie utworzono kodu,
* nie zainstalowano bibliotek,
* nie dodano dodatkowego wychowawcy,
* nie rozpoczęto implementacji.
