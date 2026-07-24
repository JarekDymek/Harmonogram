# DECYZJE PROJEKTOWE

## 1. Cel dokumentu

Dokument zawiera wiążące decyzje projektowe dotyczące pierwszej wersji aplikacji.

W przypadku sprzeczności pomiędzy wcześniejszymi dokumentami a niniejszym dokumentem pierwszeństwo ma `DECYZJE_PROJEKTOWE.md`.

Dokument nie zastępuje weryfikacji prawnej. Decyzje dotyczące sposobu działania aplikacji są wiążące, natomiast wartości wynikające z prawa muszą zostać osobno potwierdzone w aktualnych źródłach prawnych.

---

# I. ZAKRES PIERWSZEJ WERSJI

## DP-001. Artefakt wynikowy

Pierwsza wersja aplikacji generuje pełny sześciotygodniowy cykl harmonogramu dla:

* jednej grupy wychowawczej,
* dokładnie trzech wychowawców,
* sześciu kolejnych tygodni,
* z uwzględnieniem przejścia pomiędzy kolejnymi tygodniami,
* z uwzględnieniem przejścia z tygodnia szóstego do tygodnia pierwszego.

Cykl jest traktowany jako powtarzalny.

Aplikacja może prezentować osobno poszczególne tygodnie, ale każdy tydzień musi być generowany i walidowany w kontekście całego cyklu.

## DP-002. Funkcje przyszłe

Do pierwszej wersji nie należą:

* ręczna edycja wygenerowanego harmonogramu,
* blokowanie ręcznie wpisanych zmian,
* import i eksport JSON,
* baza danych,
* obsługa wielu grup,
* porównywanie z poprzednim harmonogramem,
* minimalizacja zmian względem poprzedniej wersji.

Model może umożliwiać późniejsze dodanie tych funkcji, ale nie mogą one wpływać na kryteria akceptacji pierwszej wersji.

---

# II. GODZINY OPIEKI I ZAPOTRZEBOWANIE

## DP-003. Dynamiczne obliczanie zapotrzebowania

Godziny wymaganej opieki są zawsze wyliczane dynamicznie dla każdej konkretnej daty.

Godziny dni roboczych, nauki i pobytu poza internatem nie są ukrytymi stałymi systemu. Wartości:

* 06:00–08:00,
* 14:30–22:00,
* 08:00–14:30.

mogą występować jako jawna konfiguracja albo dane demonstracyjne.

Zapotrzebowanie oblicza się przez odjęcie od godzin funkcjonowania internatu przedziałów, w których opieka wychowawcy internatu nie jest wymagana.

Zatwierdzony przez placówkę bazowy wzorzec weekendowy obejmuje wymaganą opiekę:

* w sobotę `[06:00,22:00)`,
* w niedzielę `[06:00,22:00)`.

Jest to rzeczywista reguła biznesowa aktualnej konfiguracji, a nie przykład Codexa. Przedziały te muszą być jawnie zapisane w zatwierdzonych planach i dokładnych szablonach weekendowych. Dzień specjalny może je zmienić wyłącznie przez kompletny plan daty oraz, gdy jest potrzebny, jawnie zatwierdzony wariant weekendowy `SUBSTITUTE`.

## DP-004. Jawna konfiguracja bazowa

Użytkownik może utworzyć podstawowy tygodniowy profil funkcjonowania internatu i pobytu wychowanków poza internatem.

Profil musi być:

* jawnie zapisany,
* widoczny dla użytkownika,
* możliwy do edycji,
* zatwierdzony przed generowaniem.

Aplikacja nie może używać niewidocznych wartości domyślnych.

## DP-005. Wyjątek dla konkretnej daty

Wyjątek dla konkretnej daty zastępuje pełną konfigurację tego dnia.

Dla dnia specjalnego użytkownik definiuje kompletny stan dnia, obejmujący:

* godziny funkcjonowania internatu,
* wszystkie przedziały, w których opieka internatu nie jest wymagana,
* opis dnia specjalnego.

Nie stosuje się w pierwszej wersji operacji częściowego typu `ADD`, `REMOVE` ani `REPLACE_INTERVAL`.

Jeżeli użytkownik chce zmienić tylko jeden przedział, aplikacja powinna skopiować podstawowy plan dnia do formularza wyjątku, pozwolić go zmodyfikować, a następnie zapisać cały kompletny plan konkretnej daty.

## DP-006. Hierarchia źródeł planu

Dla konkretnej daty obowiązuje kolejność:

1. kompletny wyjątek dla konkretnej daty,
2. kompletny plan konkretnego tygodnia cyklu,
3. podstawowy profil dnia tygodnia,
4. brak danych.

Nie istnieje czwarty poziom zawierający ukrytą konfigurację domyślną.

Jeżeli żaden poziom nie zawiera pełnych danych, generator nie może się uruchomić.

---

# III. CZAS

## DP-007. Krok czasowy

W pierwszej wersji krok czasowy jest stały i wynosi:

`30 minut`

Pole `timeStepMinutes` może pozostać w modelu danych, ale w pierwszej wersji jego jedyną dozwoloną wartością jest `30`.

Inna wartość powoduje błąd danych wejściowych.

## DP-008. Minimalna długość odcinka

W pierwszej wersji każdy ciągły odcinek pracy musi trwać co najmniej:

`2 godziny`

Jest to krytyczna reguła organizacyjna pierwszej wersji.

Wartość może być przygotowana technicznie jako parametr przyszłej wersji, ale użytkownik pierwszej wersji nie może jej zmieniać.

## DP-009. Przejście przez północ

W pierwszej wersji żaden odcinek pracy wychowawcy nie może przechodzić przez północ.

Każdy odcinek musi:

* rozpoczynać się i kończyć tego samego dnia,
* mieścić się w godzinach wymaganej opieki,
* kończyć się najpóźniej o godzinie zakończenia dziennej pracy wychowawców.

Pracownicy nocni pozostają poza zakresem modelu pierwszej wersji.

---

# IV. LICZBA DNI I GODZIN

## DP-010. Liczba dni pracy

Każdy wychowawca pracuje dokładnie:

`5 dni w każdym tygodniu`

Jest to jedna globalna reguła pierwszej wersji.

Nie należy przechowywać odrębnej wartości liczby dni pracy:

* dla każdego wychowawcy,
* dla każdego tygodnia,
* w kilku różnych konfiguracjach.

Autorytatywnym źródłem jest globalna konfiguracja organizacyjna.

Dzień z co najmniej jednym odcinkiem jest dniem pracy.

Dwa lub więcej odcinków tego samego dnia nadal oznaczają jeden dzień pracy.

## DP-011. Podstawowy przydział godzin

Każdy wychowawca posiada podstawowy tygodniowy przydział godzin wynikający z arkusza organizacyjnego.

Przydziały nie muszą być równe pomiędzy wychowawcami.

Generator nie może ich samodzielnie zmieniać.

## DP-012. Przydział dla konkretnego tygodnia

Podstawowy przydział godzin obowiązuje w każdym tygodniu, chyba że użytkownik jawnie określi zatwierdzony przydział zastępczy dla konkretnego tygodnia cyklu.

Przydział zastępczy:

* dotyczy konkretnego wychowawcy i konkretnego tygodnia,
* zastępuje jego podstawowy przydział w tym tygodniu,
* musi zostać podany przez użytkownika,
* nie może być obliczany ani proponowany automatycznie przez generator.

Pozwala to obsłużyć święta, dni specjalne i inne sytuacje zmieniające rzeczywiste zapotrzebowanie.

## DP-013. Bilans godzin

Dla każdego tygodnia suma obowiązujących w tym tygodniu przydziałów wszystkich wychowawców musi dokładnie odpowiadać rzeczywistemu zapotrzebowaniu.

Jeżeli wartości nie są równe, dane wejściowe otrzymują status:

`DANE_NIEPOPRAWNE`

Generator nie zostaje uruchomiony.

Aplikacja podaje:

* numer tygodnia,
* daty tygodnia,
* zapotrzebowanie,
* sumę przydziałów,
* różnicę,
* zdarzenia wpływające na zapotrzebowanie.

Niezgodna suma nie jest statusem `BRAK_ROZWIAZANIA`, ponieważ jest wykrywana przed uruchomieniem solvera.

---

# V. WEEKENDY

## DP-014. Krytyczny charakter rotacji weekendowej

Wszystkie poniższe reguły są krytyczne:

* weekend obsługują dokładnie dwaj wychowawcy,
* trzeci wychowawca ma wolną sobotę i niedzielę,
* para, osoba wolna, dokładne godziny, osoby i kolejność odcinków wynikają z zatwierdzonego wzorca danego wariantu,
* sobota i niedziela posiadają osobne dokładne szablony,
* rzeczywiste przydziały muszą być identyczne z krotkami `(dayOfWeek, sequenceNumber, educatorId, startTime, endTime)`,
* nie stosuje się tolerancji czasu ani zamiany osób lub odcinków,
* obowiązuje ustalona sześciotygodniowa rotacja,
* każdy wychowawca ma dwa wolne weekendy w cyklu,
* każda para pracuje razem dwa razy.

Reguły te nie mogą zostać pominięte ani zastąpione ostrzeżeniem.

Nie zakłada się automatycznie tej samej godziny przekazania, tej samej kolejności osób ani odwrócenia lub zakazu odwrócenia kolejności między sobotą i niedzielą. Rozstrzyga wyłącznie zatwierdzony dokładny wzorzec. Role `RANO`, `PO_POLUDNIU` i `WOLNE` mogą istnieć tylko jako etykiety prezentacyjne `DERIVED`.

## DP-015. Kolejność rotacji

Obowiązuje cykl:

1. pracują A i B, C ma wolny weekend,
2. pracują A i C, B ma wolny weekend,
3. pracują B i C, A ma wolny weekend,
4. pracują B i A, C ma wolny weekend,
5. pracują C i A, B ma wolny weekend,
6. pracują C i B, A ma wolny weekend.

Użytkownik może wybrać pozycję początkową cyklu, ale nie może zmieniać zależności pomiędzy wariantami.

Kolejność liter nie ustanawia roli godzinowej. Dla każdej pozycji obowiązują osobne, zatwierdzone szablony soboty i niedzieli.

## DP-016. Podział godzin weekendu

Podział 8 godzin + 8 godzin pozostaje mierzalnym punktem odniesienia funkcji oceny, ale zatwierdzony dokładny wzorzec weekendowy jest regułą krytyczną.

Kara nierównego podziału może służyć wyłącznie:

* raportowaniu jakości zatwierdzonego wzorca albo
* porównaniu kilku jawnie zatwierdzonych wariantów `SUBSTITUTE`, jeżeli wszystkie są dopuszczone dla tego samego weekendu.

Nie upoważnia generatora do zmiany godziny, osoby, kolejności ani długości odcinka zatwierdzonego wzorca.

## DP-017. Możliwość pracy w weekend

W pierwszej wersji wszyscy trzej wychowawcy muszą być dopuszczeni do pracy weekendowej.

Pole `canWorkWeekends` należy:

* usunąć z obowiązkowych danych pierwszej wersji albo
* wymagać, aby dla wszystkich trzech osób miało wartość `true`.

Wartość `false` jest niepoprawną konfiguracją danych wejściowych dla sztywnej rotacji trzyosobowej.

---

# VI. NIEDOSTĘPNOŚĆ

## DP-018. Niedostępność bezwzględna

Niedostępność `HARD` jest regułą krytyczną.

Nie może zostać naruszona przez generator.

## DP-019. Niedostępność preferowana

Niedostępność `PREFERRED` jest preferencją.

Może zostać naruszona wyłącznie przez harmonogram spełniający wszystkie reguły krytyczne i powoduje:

* punkty karne,
* ostrzeżenie w raporcie.

## DP-020. Łączenie niedostępności

Wszystkie obowiązujące wpisy niedostępności są sumowane.

Zakresy:

* cykliczny tygodniowy,
* dla konkretnego tygodnia cyklu,
* dla konkretnej daty

nie zastępują się automatycznie.

Jeżeli przedziały się nakładają:

* `HARD` ma pierwszeństwo nad `PREFERRED`,
* nakładające się wpisy tego samego typu są scalane,
* brak wpisu oznacza możliwość przydzielenia pracy, ale nie gwarantuje przydzielenia.

---

# VII. OBSADA

## DP-021. Liczba wymaganych wychowawców

W pierwszej wersji każdy przedział wymaganej opieki wymaga dokładnie:

`1 wychowawcy`

Generator musi zapewnić dokładnie jedną osobę.

Nie istnieje funkcja dopuszczania dodatkowej lub podwójnej obsady w pierwszej wersji.

Pola:

* `defaultRequiredStaffCount`,
* `requiredStaffCount`,
* `allowDoubleStaffing`

nie mogą tworzyć kilku źródeł prawdy.

Autorytatywna reguła pierwszej wersji to dokładnie jedna osoba w każdym wymaganym slocie.

Model może zachować `requiredStaffCount`, ale jego jedyną dozwoloną wartością w pierwszej wersji jest `1`.

Pole to jest `DERIVED` i nie należy do surowych danych użytkownika. Jeżeli kalkulator wytworzy wartość inną niż `1`, jest to `INTERNAL_ERROR` i `BLAD_WEWNETRZNY`, a nie `INVALID_INPUT`.

---

# VIII. CYKL I ODPOCZYNKI

## DP-022. Powtarzalność cyklu

Sześciotygodniowy cykl jest kołowy.

Walidacja obejmuje:

* każdy kolejny dzień,
* przejście niedziela–poniedziałek,
* przejście tydzień 1 → tydzień 2,
* wszystkie pozostałe granice tygodni,
* przejście tydzień 6 → tydzień 1 kolejnego cyklu.

Dzięki temu walidator posiada pełny kontekst dla odpoczynków na początku i końcu cyklu.

## DP-023. Niezależność walidatora

Walidator nie może bezwarunkowo ufać obiektowi `CalculatedCareRequirement`.

Walidator musi niezależnie:

1. odczytać surową konfigurację godzin funkcjonowania,
2. odczytać kompletny plan każdej daty,
3. ponownie obliczyć przedziały wymaganej opieki,
4. porównać własny wynik z wynikiem kalkulatora zapotrzebowania,
5. zgłosić błąd wewnętrzny, jeżeli wyniki są różne,
6. dopiero następnie sprawdzić pokrycie harmonogramu.

Walidator samodzielnie oblicza również:

* liczbę godzin,
* liczbę dni pracy,
* dni dzielone,
* długość odcinków,
* odpoczynki,
* dokładne krotki weekendowe i ich zgodność z zatwierdzonymi szablonami.

Nie może ufać gotowym podsumowaniom wygenerowanym przez generator.

---

# IX. WARTOŚCI PRAWNE

## DP-024. Status konfiguracji prawnej

Konfiguracja prawna posiada status:

* `UNVERIFIED`,
* `VERIFIED`,
* `EXPIRED`.

Generowanie harmonogramu przeznaczonego do rzeczywistego użycia jest możliwe wyłącznie przy statusie:

`VERIFIED`

Przy statusie `UNVERIFIED` aplikacja może działać wyłącznie w jawnie oznaczonym trybie demonstracyjnym.

Wynik trybu demonstracyjnego musi zawierać komunikat, że nie został zatwierdzony do rzeczywistego użycia.

Status `EXPIRED` blokuje generowanie produkcyjne.

Status `EXPIRED` może zostać użyty wyłącznie w jawnie wybranym trybie demonstracyjnym zgodnie z `DP-051`.

## DP-025. Ślad prawny

Konfiguracja prawna musi przechowywać:

* jurysdykcję,
* nazwę aktu prawnego albo źródła,
* jednostkę redakcyjną, jeżeli jest dostępna,
* adres albo identyfikator źródła,
* datę weryfikacji,
* datę obowiązywania,
* osobę albo rolę zatwierdzającą,
* numer wersji konfiguracji,
* uwagi interpretacyjne,
* status weryfikacji.

## DP-026. Wartości prawne nie są ustalane przez Codexa

Codex nie może sam uznać za prawnie zatwierdzone wartości:

* odpoczynku dobowego,
* odpoczynku tygodniowego,
* wyjątków od odpoczynku,
* maksymalnej długości pracy w dobie,
* maksymalnej długości pojedynczego odcinka,
* zasad wolnych weekendów,
* sposobu rozliczania godzin ponadwymiarowych.

Do czasu odrębnej weryfikacji prawnej wartości 11 i 35 godzin pozostają robocze i mogą być używane wyłącznie w trybie demonstracyjnym.

---

# X. STATUSY SYSTEMOWE

## DP-027. Walidacja danych wejściowych

Statusy:

* `NOT_VALIDATED`,
* `VALID_INPUT`,
* `INVALID_INPUT`.

Polski komunikat dla `INVALID_INPUT`:

`DANE_NIEPOPRAWNE`

## DP-028. Przebieg solvera

Statusy:

* `NOT_STARTED`,
* `RUNNING`,
* `CANDIDATE_FOUND`,
* `NO_SOLUTION`,
* `TIME_LIMIT`,
* `INTERNAL_ERROR`.

Status `CANDIDATE_FOUND` nie oznacza jeszcze poprawnego harmonogramu.

## DP-029. Walidacja harmonogramu

Statusy:

* `NOT_VALIDATED`,
* `VALID`,
* `INVALID`.

Dopiero po wyniku `VALID` harmonogram może zostać przedstawiony jako poprawny.

## DP-030. Publiczny wynik operacji

Publiczne wyniki:

* `DANE_NIEPOPRAWNE`,
* `BRAK_ROZWIAZANIA`,
* `NIE_ZAKONCZONO_WYSZUKIWANIA`,
* `BLAD_WEWNETRZNY`,
* `POPRAWNY`,
* `POPRAWNY_TRYB_DEMONSTRACYJNY`.

## DP-031. Limit czasu

Jeżeli solver osiągnie limit czasu:

* nie wolno zwrócić statusu `BRAK_ROZWIAZANIA`,
* znaleziony kandydat nie może być przedstawiony jako końcowy harmonogram,
* wynik operacji ma status `NIE_ZAKONCZONO_WYSZUKIWANIA`,
* kandydat może zostać zachowany wyłącznie do celów diagnostycznych.

---

# XI. IDENTYFIKATORY REGUŁ

## DP-032. Stabilne identyfikatory

Każda reguła krytyczna i preferowana musi posiadać globalny, niezmienny identyfikator.

Identyfikatory nie mogą zależeć od numerów sekcji dokumentu.

Należy stosować format:

`REQ-KATEGORIA-NUMER`

Przykłady:

* `REQ-COVERAGE-001`,
* `REQ-HOURS-001`,
* `REQ-DAYS-001`,
* `REQ-REST-DAILY-001`,
* `REQ-REST-WEEKLY-001`,
* `REQ-WEEKEND-001`,
* `REQ-UNAVAILABLE-HARD-001`,
* `REQ-SPECIAL-DAY-001`.

Te same identyfikatory muszą być używane przez:

* dokumentację,
* generator,
* walidator,
* komunikaty błędów,
* testy,
* raport konfliktów.

---

# XII. RAPORT BRAKU ROZWIĄZANIA

## DP-033. Poziom dokładności raportu

Pierwsza wersja nie musi gwarantować matematycznie najmniejszego pod względem liczby elementów zbioru konfliktów.

Raport powinien wskazywać:

* konkretny zestaw reguł powodujących konflikt,
* wychowawców,
* daty,
* przedziały,
* wartości wymagane i faktyczne,
* pola danych do sprawdzenia.

Raport posiada pole:

`conflictAnalysisQuality`

Dozwolone wartości:

* `EXACT`,
* `INCLUSION_MINIMAL`,
* `APPROXIMATE`.

Aplikacja nie może przedstawiać raportu `APPROXIMATE` jako matematycznie minimalnego.

---

# XIII. MODEL DANYCH

## DP-034. Kierunek relacji

Autorytatywnym źródłem relacji jest referencja:

`dziecko → rodzic`

Przykłady:

* grupa wskazuje wersję konfiguracji,
* tydzień wskazuje cykl,
* przydział wskazuje tydzień,
* komunikat wskazuje raport.

Tablice identyfikatorów dzieci w encji rodzica są:

* polami wyliczanymi,
* widokami,
* wynikami zapytania,

a nie drugim niezależnym źródłem prawdy.

## DP-035. Pola pochodne

Pola takie jak:

* `durationMinutes`,
* `assignedMinutes`,
* `workDaysCount`,
* `splitDaysCount`,
* liczniki błędów,
* sumy godzin

są wartościami pochodnymi.

Walidator musi potrafić obliczyć je z danych źródłowych.

Jeżeli są przechowywane, muszą być oznaczone jako materializowane dane pochodne i sprawdzane pod kątem zgodności ze źródłem.

## DP-036. Przypisanie danych do grupy

Dane wpływające na zapotrzebowanie muszą być przypisane do grupy wychowawczej.

Dotyczy to:

* godzin funkcjonowania internatu,
* planu pobytu poza internatem,
* dni specjalnych,
* obliczonego zapotrzebowania,
* wymaganych przedziałów opieki.

Pierwsza wersja obsługuje jedną grupę, ale model nie może uniemożliwiać późniejszego dodania kolejnych grup z innymi planami.

---

# XIV. WYDARZENIA NIESTANDARDOWE

## DP-037. Typ wydarzenia

Wydarzenie posiada:

* pole `eventType` z kontrolowanej listy,
* pole `customEventType` używane, gdy `eventType = CUSTOM`,
* pole `description` zawierające opis narracyjny.

Przykładowe typy:

* `SCHOOL`,
* `INTERNSHIP`,
* `TRIP`,
* `CEREMONY`,
* `ACTIVITY_OUTSIDE`,
* `OTHER_CARE`,
* `CUSTOM`.

Lista może zostać rozszerzona w przyszłości.

---

# XV. PREFERENCJE

## DP-038. Preferencje pierwszej wersji

Pierwsza wersja ocenia wyłącznie mierzalne preferencje:

* podział popołudnia możliwie blisko 17:00,
* podział weekendu możliwie blisko 8 godzin + 8 godzin,
* minimalizacja liczby dni dzielonych,
* minimalizacja odcinków przekraczających preferowane 8 godzin,
* unikanie niedostępności `PREFERRED`.

Dokładne wzory, wagi i sposób rozstrzygania remisów określa `DP-049`. Preferencja weekendowa nie może zmieniać zatwierdzonego wzorca.

## DP-039. Preferencje odłożone

Poza zakresem pierwszej wersji pozostają niemierzalne obecnie określenia:

* prostszy harmonogram,
* łatwiejszy do zapamiętania,
* bardziej czytelny,
* bardziej regularny,
* stabilny względem poprzedniej wersji.

Nie mogą być używane przez funkcję oceny, dopóki nie otrzymają:

* jednoznacznego wzoru,
* wagi,
* testu.

---

# XVI. NAZEWNICTWO PLIKÓW

## DP-040. Nazwa specyfikacji

Ujednolić nazwę pliku do:

`SPECYFIKACJA.md`

Wszystkie odwołania w dokumentacji muszą używać dokładnie tej samej wielkości liter.

---

# XVII. DOPRECYZOWANIA V2

## DP-041. Unikalność zatwierdzonego planu dnia

Dla wersji konfiguracji i grupy istnieje dokładnie jeden zatwierdzony `BASE_WEEKLY` dla każdego dnia tygodnia oraz najwyżej jeden zatwierdzony `CYCLE_WEEK` i `SPECIFIC_DATE` dla właściwego klucza.

Klucze:

* `BASE_WEEKLY`: `configurationVersionId`, `groupId`, `scope`, `dayOfWeek`,
* `CYCLE_WEEK`: `configurationVersionId`, `groupId`, `scope`, `weekNumber`, `dayOfWeek`,
* `SPECIFIC_DATE`: `configurationVersionId`, `groupId`, `scope`, `date`.

Dla każdej z 42 dat hierarchia wskazuje dokładnie jeden skuteczny plan. Duplikat zatwierdzonych planów albo brak skutecznego planu powoduje `INVALID_INPUT` i `REQ-SPECIAL-DAY-001`. Moduły nie używają pojęcia „pierwszy znaleziony plan”.

## DP-042. Poniedziałek jako początek tygodnia

W V1:

* `cycleStartDate` przypada w poniedziałek,
* `weekStartDay = MONDAY`,
* tydzień `n` zaczyna się `cycleStartDate + 7 × (n - 1) dni`,
* sobota i niedziela są szóstą i siódmą datą tygodnia.

Niezgodna data powoduje `INVALID_INPUT`, `DANE_NIEPOPRAWNE` i `REQ-CROSS-WEEK-001`.

Pozycja wariantu tygodnia `n` wynosi:

`1 + ((startingWeekendVariant - 1 + n - 1) mod 6)`.

## DP-043. Jawna strefa IANA

`ScheduleConfigurationVersion.timeZoneId` jest wymagane. W V1 widocznie wstępnie wybraną wartością jest `Europe/Warsaw`; użytkownik widzi i zatwierdza ją, a generator nie uzupełnia jej niewidocznie.

Odpoczynki są rzeczywistą liczbą minut na osi czasu utworzonej z lokalnej daty, czasu i strefy IANA. Brak strefy oraz nieistniejąca albo niejednoznaczna lokalna granica czasu powodują `INVALID_INPUT`.

## DP-044. Dokładne weekendowe wzorce godzinowe

Każdy z sześciu wariantów `BASE` przechowuje zatwierdzony, dokładny szablon soboty i niedzieli. Każdy szablon składa się z uporządkowanych przydziałów zawierających osobę, początek, koniec i `sequenceNumber`.

Generator traktuje te przydziały jako ustalone dane. Nie może zmieniać godzin, osób, kolejności, odcinków ani tworzyć zastępstwa. Walidator porównuje bez tolerancji krotki:

`(dayOfWeek, sequenceNumber, educatorId, startTime, endTime)`.

Dzień specjalny niezgodny z wariantem bazowym wymaga dokładnie jednego jawnego, zatwierdzonego wariantu `SUBSTITUTE`, obejmującego pełny wzorzec obu dni. Brak wariantu powoduje `INVALID_INPUT`. Wariant zastępczy nie zmienia pozycji rotacji bazowej.

## DP-045. Strukturalna konfiguracja odpoczynku tygodniowego

Autorytatywny `LegalRulesConfiguration` przechowuje:

* `weeklyRestWindowType`: `FIXED_LOCAL_WEEK` albo `ROLLING_DURATION`,
* długość i krok okna,
* dzień i godzinę kotwicy,
* minimalny odpoczynek,
* `weeklyRestAttributionMode`: `FULLY_CONTAINED` albo `INTERSECTION_WITH_WINDOW`,
* regułę ponownego użycia odpoczynku między oknami,
* włączenie, minimum, maksymalną liczbę i minimalny odstęp wyjątków,
* włączenie, wymiar i termin kompensacji.

W profilu `VERIFIED` cała metoda i wszystkie używane wartości należą do zatwierdzonego śladu prawnego. Powiązanie weekendu z wymaganiem odpoczynku może być wyłącznie audytowe albo `DERIVED`; nie jest drugim źródłem prawa.

## DP-046. Poziomy testów

Obowiązują poziomy:

| Poziom | Oczekiwane statusy |
|---|---|
| `INPUT_VALIDATION` | `VALID_INPUT`, `INVALID_INPUT` |
| `CALCULATOR_UNIT` | `CALCULATION_OK`, `INTERNAL_ERROR` |
| `RULE_VALIDATOR_UNIT` | `RULE_SATISFIED`, `RULE_VIOLATED` |
| `SOLVER_INTEGRATION` | status `GenerationRun` |
| `END_TO_END` | publiczny wynik oraz pełny `ValidationReport` |

Każdy test ma poziom, kompletny fixture właściwy dla poziomu, pełną zmianę, oczekiwany status, `ruleId` oraz wartości wymagane i faktyczne. `VALID` i `INVALID` są zastrzeżone dla pełnego `ValidationReport`.

## DP-047. Błędy pól pochodnych

Wartość `DERIVED` nie jest danymi użytkownika. Jeżeli kalkulator utworzy niepoprawne `requiredStaffCount` albo inne pole pochodne, wynik modułu to `INTERNAL_ERROR`, publicznie `BLAD_WEWNETRZNY`.

Główny `ruleId` dla rozbieżności wynosi `REQ-VALIDATOR-INDEP-001`; kontekst wskazuje odpowiednią regułę dziedzinową, w tym `REQ-STAFFING-001`.

## DP-048. Normalizacja przedziałów jako operacja na zbiorach

Godziny funkcjonowania oraz okresy bez wymaganej opieki są osobno sortowane i scalane do rozłącznych list kanonicznych; scala się przedziały nakładające i stykające.

Zapotrzebowanie wynosi:

`union(operatingIntervals) \ union(noCareIntervals)`.

Okres bez wymaganej opieki musi należeć w całości do sumy godzin funkcjonowania, inaczej dane są `INVALID_INPUT`. Kalkulator i niezależny walidator normalizują źródła osobno. Minuty części wspólnej nigdy nie są liczone podwójnie.

## DP-049. Kompletna funkcja celu

Przy kroku 30 minut:

* `P_afternoon = Σ |handoverMinute - preferredAfternoonHandoverMinute| / timeStepMinutes` dla przekazań w roboczym ciągłym przedziale zawierającym godzinę preferowaną; brak takiego popytu albo brak podziału daje `0`,
* `P_weekend = Σ |assignedMinutes - preferredWeekendSplitMinutes| / timeStepMinutes`, osobno dla obu osób i obu dni,
* `P_splitDays = Σ max(0, segmentCount(educator, date) - 1)`,
* `P_longSegments = Σ max(0, durationMinutes - preferredMaximumSegmentMinutes) / timeStepMinutes`,
* `P_preferredUnavailable` jest liczbą przypisanych slotów przecinających znormalizowane `PREFERRED` po dominacji `HARD`.

Łączny wynik:

`objectiveScore = wA × P_afternoon + wW × P_weekend + wS × P_splitDays + wL × P_longSegments + wU × P_preferredUnavailable`.

Wagi są jawnymi, nieujemnymi liczbami całkowitymi zatwierdzonej konfiguracji organizacyjnej. Remis rozstrzyga mniejszy wektor kar w powyższej kolejności, a następnie kanoniczna lista `(date, startTime, endTime, educatorId)`.

`P_weekend` nie może modyfikować zatwierdzonego wzorca. Służy tylko do raportowania albo porównania kilku zatwierdzonych wariantów `SUBSTITUTE`.

## DP-050. Integralność wersji konfiguracji i grupy

Dla wersji istnieje dokładnie jedna konfiguracja organizacyjna i dokładnie jeden wybrany profil prawny. V1 posiada jedną aktywną grupę oraz dokładnie trzech aktywnych wychowawców tej grupy.

Nie występuje wychowawca rezerwowy ani pula międzygrupowa. Dokładnie dwóch wychowawców pracuje w weekend, trzeci ma wolne, a podwójna obsada pozostaje zabroniona.

Grupa, wychowawcy, plany, przedziały, popyt, przydziały zastępcze, warianty weekendowe, uruchomienie i harmonogram należą do tej samej wersji i grupy. `offEducatorId` oraz dwaj pracujący są różni i razem tworzą zbiór trzech aktywnych wychowawców. `ScheduleWeek.weekendVariantId` wskazuje zatwierdzony wariant właściwej wersji i pozycji.

Relacja dziecko → rodzic jest autorytatywna; tablice dzieci są `DERIVED`. Referencje między wersjami albo grupami powodują `INVALID_INPUT`.

## DP-051. Tryb demonstracyjny dla profilu `EXPIRED`

| Profil | Tryb | Solver | Poprawny wynik |
|---|---|---:|---|
| `VERIFIED` | `PRODUCTION` | startuje | `POPRAWNY` |
| `VERIFIED` | `DEMONSTRATION` | startuje | `POPRAWNY_TRYB_DEMONSTRACYJNY` |
| `UNVERIFIED` | `PRODUCTION` | nie startuje | `DANE_NIEPOPRAWNE` |
| `UNVERIFIED` | `DEMONSTRATION` | startuje | `POPRAWNY_TRYB_DEMONSTRACYJNY` |
| `EXPIRED` | `PRODUCTION` | nie startuje | `DANE_NIEPOPRAWNE` |
| `EXPIRED` | `DEMONSTRATION` | startuje | `POPRAWNY_TRYB_DEMONSTRACYJNY` |

Wynik demonstracyjny pokazuje brak dopuszczenia do rzeczywistego użycia, status i wersję profilu oraz datę weryfikacji albo wygaśnięcia. `EXPIRED` nigdy nie daje `POPRAWNY`.

---

# XVIII. ZASADA KOŃCOWA

Decyzje `DP-001`–`DP-051` są wiążącym źródłem dla aktywnej dokumentacji projektu.

Na etapie aktualizacji dokumentacji:

1. ujednolica się `SPECYFIKACJA.md`, `ZASADY.md`, `WALIDACJA.md`, `DANE_WEJSCIOWE.md`, `ALGORYTM.md`, `MODEL_DANYCH.md` i `TESTY_I_SCENARIUSZE.md`,
2. nie modyfikuje się historycznych raportów spójności,
3. nie tworzy się kodu,
4. nie instaluje się bibliotek,
5. nie wybiera się technologii ani solvera,
6. nierozstrzygnięte wartości prawne pozostają w wersjonowanym profilu prawnym i wymagają zewnętrznego zatwierdzenia.
