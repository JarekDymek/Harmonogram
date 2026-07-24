# WALIDACJA HARMONOGRAMU

## 1. Cel walidatora

Walidator jest niezależnym modułem sprawdzającym pełny, powtarzalny cykl sześciu tygodni.

W pierwszej wersji sprawdza jedną grupę i dokładnie trzech wychowawców, włącznie z przejściem tydzień 6 → tydzień 1. Nie waliduje ręcznej edycji, blokowania zmian, bazy danych, importu ani eksportu JSON, wielu grup ani porównania z wcześniejszym harmonogramem.

Nie występuje wychowawca rezerwowy, pula międzygrupowa ani dopuszczalna podwójna obsada.

Walidator:

* otrzymuje surową, zatwierdzoną wersję konfiguracji,
* otrzymuje wynik kalkulatora zapotrzebowania,
* otrzymuje kandydata generatora,
* ponownie oblicza zapotrzebowanie z surowych planów,
* samodzielnie oblicza wszystkie podsumowania,
* zbiera wszystkie możliwe do wykrycia naruszenia,
* nie poprawia harmonogramu.

Generator nie może sam uznać kandydata za poprawny.

---

# I. STATUSY I KOMUNIKATY

## 1. Status walidacji harmonogramu

* `NOT_VALIDATED`,
* `VALID`,
* `INVALID`.

`VALID` jest możliwe wyłącznie przy zerowej liczbie błędów krytycznych.

## 2. Publiczny wynik

Po walidacji:

* `POPRAWNY` – wynik `VALID`, konfiguracja prawna `VERIFIED` i tryb `PRODUCTION`,
* `POPRAWNY_TRYB_DEMONSTRACYJNY` – wynik `VALID` i jawny tryb `DEMONSTRATION` dla profilu `VERIFIED`, `UNVERIFIED` albo `EXPIRED`,
* `BLAD_WEWNETRZNY` – kandydat narusza regułę krytyczną albo obliczenia modułów są rozbieżne.

Status `EXPIRED` blokuje tryb produkcyjny przed solverem.

## 3. Poziomy komunikatów

* `ERROR` – naruszenie reguły krytycznej,
* `WARNING` – niespełniona preferencja,
* `INFO` – informacja opisowa.

Każdy komunikat zawiera:

* `ruleId`,
* `severity`,
* `educatorId`, jeżeli dotyczy,
* `groupId`,
* datę lub zakres dat,
* przedział czasu, jeżeli dotyczy,
* opis,
* wartość wymaganą,
* wartość faktyczną,
* kontekst.

---

# II. NIEZALEŻNOŚĆ WALIDATORA

## `REQ-VALIDATOR-INDEP-001`

Walidator nie ufa:

* `CalculatedCareRequirement`,
* `durationMinutes`,
* podsumowaniu godzin,
* liczbie dni pracy,
* liczbie dni dzielonych,
* podsumowaniom odpoczynków,
* rolom weekendowym wyliczonym przez generator.

Walidator samodzielnie:

1. sprawdza unikalność zatwierdzonych planów i wybiera skuteczny plan każdej z 42 dat,
2. osobno normalizuje godziny funkcjonowania i okresy bez wymaganej opieki,
3. oblicza `union(operatingIntervals) \ union(noCareIntervals)`,
4. tworzy własne przedziały wymaganej opieki,
5. porównuje je z `CalculatedCareRequirement`,
6. rekonstruuje odcinki z przydziałów,
7. sumuje minuty i dni pracy,
8. wykrywa dni dzielone,
9. oblicza odpoczynki na osi czasu,
10. porównuje dokładne krotki weekendowe z zatwierdzonymi szablonami,
11. sprawdza cały cykl kołowo.

Rozbieżność własnego zapotrzebowania z wynikiem kalkulatora jest błędem `REQ-VALIDATOR-INDEP-001` i prowadzi do `BLAD_WEWNETRZNY`.

Dotyczy to także wartości `requiredStaffCount` innej niż `1` w wyniku kalkulatora. Pole jest `DERIVED`, nie należy do danych użytkownika, a rozbieżność powoduje `INTERNAL_ERROR`, główny `REQ-VALIDATOR-INDEP-001` i kontekst `REQ-STAFFING-001`.

---

# III. KOLEJNOŚĆ WALIDACJI

Walidator wykonuje:

1. kontrolę integralności wersji, grupy i zakresu V1,
2. kontrolę poniedziałkowej kotwicy oraz jawnej strefy IANA,
3. kontrolę konfiguracji prawnej i trybu operacji,
4. kontrolę unikalności i kompletności planów 42 dat,
5. niezależną normalizację i obliczenie zapotrzebowania,
6. porównanie zapotrzebowania z kalkulatorem,
7. kontrolę struktury przydziałów,
8. kontrolę czasu i minimalnej długości,
9. kontrolę pokrycia i obsady,
10. kontrolę zakazu pracy poza zapotrzebowaniem,
11. kontrolę niedostępności,
12. kontrolę godzin i dni pracy,
13. kontrolę odpoczynków,
14. kontrolę dokładnych wzorców weekendowych i rotacji,
15. kontrolę granic tygodni i zawinięcia cyklu,
16. ocenę preferencji według pełnych wzorów,
17. przygotowanie raportu.

Wykrycie jednego błędu nie przerywa pozostałych kontroli, jeżeli dane nadal pozwalają wykonać je bez zgadywania.

---

# IV. WALIDACJA REGUŁ KRYTYCZNYCH

## `REQ-NO-GUESSING-001`

Walidator odrzuca brakujące, ukryte, zaokrąglone albo automatycznie zastąpione dane.

Wartości przykładowe nie mogą być użyte bez jawnego wpisu w konfiguracji.

## `REQ-SPECIAL-DAY-001`

Dla każdej daty musi istnieć jeden kompletny plan wybrany w kolejności:

1. `SPECIFIC_DATE`,
2. `CYCLE_WEEK`,
3. `BASE_WEEKLY`.

Plan konkretnej daty lub tygodnia zastępuje cały plan niższego poziomu. Częściowy wyjątek jest niepoprawny.

Dla każdego klucza może istnieć najwyżej jeden zatwierdzony plan:

* `BASE_WEEKLY`: wersja, grupa, zakres i dzień tygodnia,
* `CYCLE_WEEK`: wersja, grupa, zakres, tydzień i dzień tygodnia,
* `SPECIFIC_DATE`: wersja, grupa, zakres i data.

Dla każdego dnia tygodnia istnieje dokładnie jeden zatwierdzony `BASE_WEEKLY`. Duplikat albo brak skutecznego planu powoduje `INVALID_INPUT`. Kolejność techniczna rekordów nie ma znaczenia.

## `REQ-TIME-STEP-001`

`timeStepMinutes` wynosi dokładnie `30`.

Każda granica czasu ma minuty `00` albo `30`.

`cycleStartDate` przypada w poniedziałek, `weekStartDay = MONDAY`, a `timeZoneId` jest jawne. W V1 widocznie wstępnie wybrana strefa to `Europe/Warsaw`.

Brak strefy oraz nieistniejąca albo niejednoznaczna lokalna granica czasu powodują `INVALID_INPUT`.

## `REQ-TIME-SAME-DAY-001`

Każdy przedział:

* jest półotwarty `[początek, koniec)`,
* ma koniec późniejszy od początku,
* zaczyna się i kończy tej samej daty,
* nie przechodzi przez północ.

## `REQ-SEGMENT-MIN-001`

Każdy maksymalny ciąg przypisanych slotów jednej osoby trwa co najmniej 120 minut.

Każdy odcinek dnia dzielonego jest kontrolowany osobno.

## `REQ-COVERAGE-001`

Każdy slot należący do zapotrzebowania ma co najmniej jednego przypisanego wychowawcę.

Komunikat luki podaje datę, początek, koniec, wartość wymaganą `1` i faktyczną `0`.

## `REQ-STAFFING-001`

Każdy wymagany slot ma dokładnie jednego wychowawcę.

Walidator odrzuca:

* obsadę większą niż `1`.

Pierwsza wersja nie ma trybu dozwolonej podwójnej obsady.

`requiredStaffCount` jest wyliczane, zawsze wynosi `1` i nie jest walidowane jako surowe wejście użytkownika. Inna wartość w `CalculatedCareRequirement` jest błędem wewnętrznym modułu.

## `REQ-NO-OUTSIDE-001`

Każdy slot przydziału musi należeć do niezależnie obliczonego zapotrzebowania tej grupy i daty.

## `REQ-HOURS-001`

Dla każdego wychowawcy i tygodnia walidator:

1. wybiera zatwierdzony przydział zastępczy, jeżeli istnieje,
2. w przeciwnym razie wybiera przydział podstawowy,
3. samodzielnie sumuje minuty odcinków,
4. wymaga dokładnej równości.

Nie stosuje się tolerancji.

## `REQ-DAYS-001`

Globalna wartość `requiredWorkDaysPerWeek` wynosi dokładnie `5`.

Walidator samodzielnie liczy unikalne daty z co najmniej jednym odcinkiem. Każdy wychowawca ma dokładnie pięć dni pracy w każdym tygodniu.

## `REQ-UNAVAILABLE-HARD-001`

Walidator samodzielnie normalizuje wpisy:

* sumuje zakresy,
* scala nakładające się wpisy tego samego typu,
* stosuje `HARD` zamiast `PREFERRED` na części wspólnej.

Żaden przydział nie może przecinać `HARD`.

Brak wpisu oznacza możliwość przydziału, a nie obowiązek pracy.

## `REQ-REST-DAILY-001`

Walidator oblicza czas od końca ostatniego odcinka daty do początku pierwszego odcinka następnej daty.

Sprawdza wszystkie 42 daty kołowo, w tym ostatnią datę tygodnia 6 i pierwszą datę tygodnia 1 kolejnego powtórzenia.

Czas odpoczynku jest rzeczywistą różnicą chwil na osi czasu utworzonej z lokalnej daty, godziny i `timeZoneId`, a nie tylko różnicą wskazań zegara.

Limit pochodzi z konfiguracji prawnej. Wartość 11 godzin jest robocza i nie jest uznawana za prawnie zatwierdzoną bez statusu `VERIFIED`.

## `REQ-REST-WEEKLY-001`

Walidator buduje kołową listę maksymalnych, ciągłych okresów bez pracy, a następnie:

1. tworzy okna według `weeklyRestWindowType`,
2. stosuje długość, krok i kotwicę okna,
3. przypisuje odpoczynek według `weeklyRestAttributionMode`,
4. respektuje `weeklyRestReuseAcrossWindowsAllowed`,
5. wymaga `minimumWeeklyRestMinutes`,
6. stosuje wyłącznie jawnie włączone, zatwierdzone minimum, limit wystąpień i odstęp wyjątku,
7. sprawdza wymiar i termin kompensacji,
8. obejmuje przejście tydzień 6 → tydzień 1.

Wartość 35 godzin pozostaje robocza do weryfikacji prawnej.

## `REQ-WEEKEND-001`

Dla soboty i niedzieli każdego tygodnia walidator wymaga:

* dokładnie dwóch pracujących wychowawców,
* jednego wychowawcy wolnego w oba dni,
* pary i osoby wolnej wskazanej przez zatwierdzony wariant,
* dokładnej zgodności rzeczywistych przydziałów z osobnym szablonem soboty i niedzieli.

Walidator porównuje bez tolerancji uporządkowane krotki:

`(dayOfWeek, sequenceNumber, educatorId, startTime, endTime)`.

Nie zakłada tej samej godziny przekazania, tej samej kolejności osób, odwrócenia ani zakazu odwrócenia kolejności między dniami. Nie używa etykiet `RANO` i `PO_POLUDNIU` jako źródła walidacji.

Dodatkowo niezależnie sprawdza pokrycie, dokładnie jedną osobę, brak pracy poza popytem, krok 30 minut, minimum 120 minut oraz odpoczynki.

Zatwierdzony bazowy popyt aktualnej konfiguracji placówki wynosi w sobotę i niedzielę `[06:00,22:00)`. Jest regułą biznesową, nie przykładem, i podlega dokładnemu porównaniu z planem oraz szablonem.

Jeżeli `SPECIFIC_DATE` zmienia weekendowy popyt, walidacja wejścia zachowuje wariant bazowy tylko wtedy, gdy nadal pasuje dokładnie. W przeciwnym razie wymaga dokładnie jednego zatwierdzonego wariantu `SUBSTITUTE` obejmującego pełny wzorzec obu dni. Brak albo duplikat powoduje `INVALID_INPUT` i `REQ-SPECIAL-DAY-001`.

## `REQ-ROTATION-001`

Walidator porównuje dokładne wzorce z sześcioma wariantami od wybranej pozycji startowej:

1. pracują A i B, C wolne,
2. pracują A i C, B wolne,
3. pracują B i C, A wolne,
4. pracują B i A, C wolne,
5. pracują C i A, B wolne,
6. pracują C i B, A wolne.

Sprawdza:

* dwa wolne weekendy każdej osoby,
* dwa wspólne weekendy każdej pary,
* dokładny szablon właściwej pozycji,
* przejście pozycji 6 → 1.

Pozycja tygodnia `n` wynosi:

`1 + ((startingWeekendVariant - 1 + n - 1) mod 6)`.

## `REQ-CROSS-WEEK-001`

Walidator nie analizuje tygodni osobno.

Kontrola obejmuje:

* każdą granicę niedziela–poniedziałek,
* wszystkie kolejne tygodnie,
* tydzień 6 → tydzień 1.

`cycleStartDate` musi przypadać w poniedziałek, `weekStartDay = MONDAY`, a sobota i niedziela są szóstą i siódmą datą tygodnia. Niezgodność wejścia powoduje `INVALID_INPUT`, `DANE_NIEPOPRAWNE` i `REQ-CROSS-WEEK-001`.

## `REQ-LEGAL-001`

Walidator sprawdza:

* `verificationStatus`,
* zakres obowiązywania,
* wersję i ślad źródła prawnego,
* tryb produkcyjny lub demonstracyjny.

| Profil | Tryb | Solver | Poprawny wynik |
|---|---|---:|---|
| `VERIFIED` | `PRODUCTION` | startuje | `POPRAWNY` |
| `VERIFIED` | `DEMONSTRATION` | startuje | `POPRAWNY_TRYB_DEMONSTRACYJNY` |
| `UNVERIFIED` | `PRODUCTION` | nie startuje | `DANE_NIEPOPRAWNE` |
| `UNVERIFIED` | `DEMONSTRATION` | startuje | `POPRAWNY_TRYB_DEMONSTRACYJNY` |
| `EXPIRED` | `PRODUCTION` | nie startuje | `DANE_NIEPOPRAWNE` |
| `EXPIRED` | `DEMONSTRATION` | startuje | `POPRAWNY_TRYB_DEMONSTRACYJNY` |

Wynik demonstracyjny zawiera brak dopuszczenia do rzeczywistego użycia, status i wersję profilu oraz datę weryfikacji albo wygaśnięcia.

---

# V. REGUŁY PREFEROWANE

Niespełnienie preferencji nie zmienia statusu `VALID`.

## `REQ-PREF-AFTERNOON-001`

`P_afternoon = Σ |handoverMinute - preferredAfternoonHandoverMinute| / timeStepMinutes`.

Uwzględnia się przekazania w roboczym ciągłym przedziale popytu zawierającym preferowaną godzinę. Brak takiego popytu albo brak podziału daje `0`.

## `REQ-PREF-WEEKEND-SPLIT-001`

`P_weekend = Σ |assignedMinutes - preferredWeekendSplitMinutes| / timeStepMinutes`, osobno dla obu osób i obu dni.

Wartość służy wyłącznie raportowaniu albo porównaniu kilku zatwierdzonych `SUBSTITUTE`; nie może zmieniać wzorca.

## `REQ-PREF-SPLIT-DAYS-001`

`P_splitDays = Σ max(0, segmentCount(educator, date) - 1)`.

## `REQ-PREF-LONG-SEGMENT-001`

`P_longSegments = Σ max(0, durationMinutes - preferredMaximumSegmentMinutes) / timeStepMinutes`.

Odcinek ponad preferowane 8 godzin powoduje ostrzeżenie, o ile nie narusza osobnego, zatwierdzonego limitu prawnego.

## `REQ-PREF-UNAVAILABLE-001`

`P_preferredUnavailable` jest liczbą przypisanych slotów przecinających znormalizowane `PREFERRED` po dominacji `HARD`.

Przydział przecinający `PREFERRED` powoduje ostrzeżenie i punkty karne.

Łączny wynik:

`objectiveScore = wA × P_afternoon + wW × P_weekend + wS × P_splitDays + wL × P_longSegments + wU × P_preferredUnavailable`.

Wagi są jawnymi, nieujemnymi liczbami całkowitymi. Remis rozstrzyga wektor pięciu kar, a potem kanoniczna lista `(date, startTime, endTime, educatorId)`.

Walidator nie ocenia prostoty, czytelności, regularności bez wzoru ani stabilności względem poprzedniego harmonogramu.

---

# VI. RAPORT KOŃCOWY

Raport zawiera:

* status `VALID` albo `INVALID`,
* publiczny wynik,
* wersję konfiguracji i walidatora,
* liczbę błędów, ostrzeżeń i informacji,
* komunikaty z `ruleId`,
* niezależnie obliczone zapotrzebowanie,
* porównanie z `CalculatedCareRequirement`,
* wyniki każdego wychowawcy i tygodnia,
* podsumowanie godzin, dni, dni dzielonych i odcinków,
* podsumowanie odpoczynków,
* podsumowanie weekendów i rotacji,
* wynik kontroli tydzień 6 → 1,
* status, wersję i datę profilu prawnego,
* strefę czasu,
* użyte dokładne wzorce weekendowe,
* pięć składników funkcji celu i `objectiveScore`.

Pola pochodne generatora mogą być pokazane porównawczo, ale nie są źródłem prawdy.

---

# VII. TESTOWALNOŚĆ

Każda reguła krytyczna musi posiadać:

* test poprawny,
* test niepoprawny,
* jednoznaczny oczekiwany status,
* oczekiwany `ruleId`,
* wartości wymagane i faktyczne.

Każdy test ma `testLevel`:

* `INPUT_VALIDATION`,
* `CALCULATOR_UNIT`,
* `RULE_VALIDATOR_UNIT`,
* `SOLVER_INTEGRATION`,
* `END_TO_END`.

`VALID` i `INVALID` są używane wyłącznie dla pełnego `ValidationReport`. Fixture jednostkowy jest kompletny dla wejścia badanego komponentu, a integracyjny i end-to-end obejmuje pełne 42 daty.

Walidator musi mieć osobne testy:

* niezależnego przeliczenia zapotrzebowania,
* rozbieżności z kalkulatorem,
* pracy poza zapotrzebowaniem,
* kołowego przejścia tydzień 6 → 1,
* scalania niedostępności,
* trybu demonstracyjnego i blokady `EXPIRED`.

Ponadto wymagane są testy unikalności planów, poniedziałkowej kotwicy, czasu letniego i zimowego, pola `DERIVED`, normalizacji zbiorów, dokładnych wartości funkcji celu, integralności wersji i grupy oraz całej tabeli profil × tryb.

---

# VIII. REJESTR IDENTYFIKATORÓW

Reguły krytyczne:

`REQ-NO-GUESSING-001`, `REQ-SPECIAL-DAY-001`, `REQ-TIME-STEP-001`, `REQ-TIME-SAME-DAY-001`, `REQ-SEGMENT-MIN-001`, `REQ-COVERAGE-001`, `REQ-STAFFING-001`, `REQ-NO-OUTSIDE-001`, `REQ-HOURS-001`, `REQ-DAYS-001`, `REQ-UNAVAILABLE-HARD-001`, `REQ-REST-DAILY-001`, `REQ-REST-WEEKLY-001`, `REQ-WEEKEND-001`, `REQ-ROTATION-001`, `REQ-CROSS-WEEK-001`, `REQ-VALIDATOR-INDEP-001`, `REQ-LEGAL-001`.

Preferencje:

`REQ-PREF-AFTERNOON-001`, `REQ-PREF-WEEKEND-SPLIT-001`, `REQ-PREF-SPLIT-DAYS-001`, `REQ-PREF-LONG-SEGMENT-001`, `REQ-PREF-UNAVAILABLE-001`.
