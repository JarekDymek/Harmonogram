# ZASADY DZIAŁANIA ALGORYTMU

## 1. Cel dokumentu

Dokument definiuje reguły krytyczne i preferowane pierwszej wersji generatora harmonogramu.

Reguła krytyczna nie może zostać naruszona. Reguła preferowana służy wyłącznie do porównywania rozwiązań, które spełniają wszystkie reguły krytyczne.

Pierwsza wersja generuje pełny, powtarzalny cykl sześciu tygodni dla jednej grupy i dokładnie trzech wychowawców.

Kontrola obejmuje przejście tydzień 6 → tydzień 1. Poza zakresem pierwszej wersji pozostają: ręczna edycja, blokowanie zmian, baza danych, import i eksport JSON, wiele grup oraz porównywanie z wcześniejszym harmonogramem. Kierunki przyszłego rozwoju nie zmieniają poniższych reguł.

Nie występuje wychowawca rezerwowy, pula międzygrupowa ani podwójna obsada.

---

# I. REGUŁY KRYTYCZNE

## `REQ-NO-GUESSING-001` – Zakaz zgadywania

Generator nie może:

* uzupełniać brakujących danych,
* używać niewidocznych wartości domyślnych,
* zaokrąglać godzin,
* zmieniać przydziałów godzin,
* ignorować dni specjalnych lub niedostępności,
* łagodzić reguł krytycznych,
* publikować częściowo poprawnego harmonogramu jako rozwiązania.

Niepoprawne lub niekompletne dane otrzymują status `INVALID_INPUT`, a publiczny wynik brzmi `DANE_NIEPOPRAWNE`.

## `REQ-SPECIAL-DAY-001` – Kompletny plan dnia

Zapotrzebowanie jest obliczane dynamicznie dla każdej daty.

Dla daty stosuje się kompletny plan z najwyższego dostępnego poziomu hierarchii:

1. kompletny plan konkretnej daty,
2. kompletny plan dnia konkretnego tygodnia cyklu,
3. kompletny podstawowy profil dnia tygodnia,
4. brak danych i błąd walidacji.

Dla każdego klucza może istnieć najwyżej jeden zatwierdzony plan:

* `BASE_WEEKLY`: wersja, grupa, zakres i dzień tygodnia,
* `CYCLE_WEEK`: wersja, grupa, zakres, numer tygodnia i dzień tygodnia,
* `SPECIFIC_DATE`: wersja, grupa, zakres i data.

Dla każdego dnia tygodnia istnieje dokładnie jeden zatwierdzony `BASE_WEEKLY`, a dla każdej z 42 dat dokładnie jeden skuteczny plan. Duplikat zatwierdzonych planów albo brak skutecznego planu powoduje `INVALID_INPUT`.

Plan wyższego poziomu zastępuje cały plan niższego poziomu. Pierwsza wersja nie wykonuje częściowych operacji `ADD`, `REMOVE` ani `REPLACE_INTERVAL`.

Każdy kompletny plan zawiera:

* grupę wychowawczą,
* godziny funkcjonowania internatu,
* wszystkie przedziały, w których opieka internatu nie jest wymagana,
* opis i dane zdarzenia, jeżeli dotyczą dnia specjalnego.

Godziny funkcjonowania i przedziały bez wymaganej opieki są traktowane jako zbiory czasu. Każdą listę sortuje się oraz scala przedziały nakładające i stykające. Zapotrzebowanie wynosi:

`union(operatingIntervals) \ union(noCareIntervals)`.

Przedział bez wymaganej opieki musi w całości należeć do sumy godzin funkcjonowania, inaczej dane są `INVALID_INPUT`.

## `REQ-TIME-STEP-001` – Krok czasowy

Krok czasowy pierwszej wersji wynosi dokładnie 30 minut.

Początek i koniec każdego przedziału muszą przypadać na pełną godzinę albo połowę godziny. Inna wartość `timeStepMinutes` niż `30` powoduje `INVALID_INPUT`.

`cycleStartDate` musi przypadać w poniedziałek, `weekStartDay = MONDAY`, a `ScheduleConfigurationVersion.timeZoneId` musi jawnie wynosić zatwierdzoną strefę IANA. W V1 widocznie wstępnie wybrana wartość to `Europe/Warsaw`.

Brak strefy oraz nieistniejąca albo niejednoznaczna lokalna granica czasu powodują `INVALID_INPUT`. Generator nie wybiera przesunięcia ani strefy niewidocznie.

## `REQ-TIME-SAME-DAY-001` – Odcinki w granicach jednej daty

Przedziały są półotwarte: `[początek, koniec)`.

Każdy odcinek:

* zaczyna się i kończy tego samego dnia,
* ma koniec późniejszy od początku,
* nie przechodzi przez północ,
* mieści się w godzinach wymaganej opieki.

Pracownicy nocni pozostają poza zakresem pierwszej wersji.

## `REQ-SEGMENT-MIN-001` – Minimalna długość odcinka

Każdy ciągły odcinek pracy trwa co najmniej 2 godziny, czyli 120 minut lub cztery sloty.

Jeżeli wychowawca pracuje kilka razy tego samego dnia, każdy odcinek jest sprawdzany osobno.

## `REQ-COVERAGE-001` – Ciągłość opieki

Dla każdego slotu należącego do dynamicznie obliczonego zapotrzebowania musi istnieć obsada.

Nie może wystąpić nawet 30-minutowa luka.

## `REQ-STAFFING-001` – Dokładnie jedna osoba

Każdy wymagany slot pierwszej wersji wymaga dokładnie jednego wychowawcy.

Nie jest dozwolona:

* obsada zerowa,
* podwójna lub większa obsada.

Jeżeli model zawiera `RequiredCareInterval.requiredStaffCount`, jedyną dozwoloną wartością pierwszej wersji jest `1`.

Pole jest `DERIVED` i nie należy do surowych danych użytkownika. Jeżeli kalkulator wytworzy wartość inną niż `1`, wynik wynosi `INTERNAL_ERROR`, publicznie `BLAD_WEWNETRZNY`, z `REQ-VALIDATOR-INDEP-001` i kontekstem `REQ-STAFFING-001`.

## `REQ-NO-OUTSIDE-001` – Zakaz pracy poza zapotrzebowaniem

Wychowawca nie może otrzymać odcinka w czasie, w którym dla jego grupy nie jest wymagana opieka internatu.

Nie wolno dodawać pracy poza zapotrzebowaniem w celu uzupełnienia godzin albo liczby dni.

## `REQ-HOURS-001` – Dokładna liczba godzin

Każdy wychowawca posiada podstawowy tygodniowy przydział minut.

Dla konkretnego tygodnia może istnieć jawnie zatwierdzony przydział zastępczy. Przydział zastępczy:

* dotyczy konkretnego wychowawcy i tygodnia,
* w całości zastępuje przydział podstawowy w tym tygodniu,
* jest wprowadzany i zatwierdzany przez użytkownika,
* nie jest tworzony ani proponowany przez generator.

Dla każdego tygodnia:

* suma obowiązujących przydziałów wszystkich wychowawców musi równać się rzeczywistemu zapotrzebowaniu przed uruchomieniem solvera,
* liczba minut przydzielonych danemu wychowawcy w harmonogramie musi dokładnie równać się jego obowiązującemu przydziałowi.

Nie stosuje się tolerancji ani przenoszenia godzin między tygodniami.

## `REQ-DAYS-001` – Najwyżej pięć kalendarzowych dni pracy

Każdy wychowawca ma najwyżej pięć dat z pracą i co najmniej dwie całkowicie wolne w tygodniu poniedziałek–niedziela. Nie wymusza się dodatkowej pracy tylko po to, by osiągnąć pięć dni.

Autorytatywnym źródłem jest:

`OrganizationalRulesConfiguration.requiredWorkDaysPerWeek = 5`

Dniem pracy jest data z jakąkolwiek pracą: szkoła, wszystkie grupy, dyżury dodatkowe i nocki. Nocka 22:00–06:00 zajmuje obie daty (również na granicy tygodni i cyklu). Kilka odcinków tej samej daty oznacza jeden dzień. Jest to reguła organizacyjna kalendarza, nie definicja prawna doby pracowniczej.

## Stałe zobowiązania i rozliczenie nocek (reguły pracy v2)

- Obowiązkowy dyżur to przydział opieki w konkretnej grupie: wykorzystuje jej wymiar godzin, nie dodaje nadgodzin. Powtarza się co tydzień do zmiany/usunięcia. Nie może kolidować z zapotrzebowaniem, inną pracą lub niedostępnością.
- Szkoła blokuje dokładne godziny i zajmuje dzień pracy. Wyszukiwanie preferuje pracę internacką w dniach już zajętych, lecz nie wymusza jej kosztem odpoczynków ani zapotrzebowania. Brakujących godzin szkoły nie wolno zgadywać.
- W dniu rozpoczęcia nocki dopuszcza się dodatkową opiekę wyłącznie 20:00–22:00, a w dniu końca 06:00–08:00. Okna są opcjonalne, chyba że wpisano obowiązkowy dyżur. Praca przyległa do nocki tworzy jeden ciągły odcinek; nadal obowiązują limity zatwierdzonego profilu. Dwa okna z nocką dają 12 godzin i nie obchodzą krótszego limitu odcinka.
- Łączny wymiar członkostwa obejmuje stałe nocki. Przykład: 30 godz. = 22 godz. opieki + 8 godz. nocki. Każda nocka obciąża jedną wybraną grupę, tylko raz, w tygodniu rozpoczęcia. Nominalny kredyt wynosi 8 godzin; rzeczywisty czas i odpoczynki pozostają zależne od strefy czasowej.
- Migracja zachowuje pierwotną konfigurację i wynik w prywatnej kopii lokalnej, dodaje kredyt nocek do dawnych godzin opieki jednokrotnie. Nie zmienia nazwisk, dostępności ani planów pobytu. Wynik walidatora starszego niż 2.0.0 wymaga nowego generowania.
- Niezależny walidator kontroluje kompletność obowiązkowych przydziałów, oba dni nocy i wszystkie źródła pracy. Komunikaty prowadzą do formularza zobowiązania, zamiast sugerować przypadkowe zmiany sum godzin.

## `REQ-UNAVAILABLE-HARD-001` – Niedostępność bezwzględna

Żaden odcinek pracy nie może nakładać się na niedostępność `HARD`.

Wpisy niedostępności:

* cykliczne tygodniowe,
* dla konkretnego tygodnia cyklu,
* dla konkretnej daty

są sumowane, a nie zastępowane.

Nakładające się wpisy tego samego typu są scalane. `HARD` dominuje nad `PREFERRED`. Brak wpisu oznacza możliwość przydzielenia pracy, ale nie gwarantuje przydziału.

Wszyscy trzej wychowawcy muszą być dopuszczeni do pracy weekendowej. Jeżeli model zachowuje `canWorkWeekends`, jego jedyną dozwoloną wartością w pierwszej wersji jest `true`.

## `REQ-REST-DAILY-001` – Odpoczynek dobowy

Od końca ostatniego odcinka jednej daty do początku pierwszego odcinka następnej daty musi upłynąć co najmniej liczba minut zatwierdzona w konfiguracji prawnej.

Kontrola obejmuje wszystkie kolejne daty oraz przejście tydzień 6 → tydzień 1.

Minuty oznaczają rzeczywisty czas na osi czasu utworzonej z lokalnej daty, czasu i `timeZoneId`, a nie tylko różnicę wskazań zegara.

Wartość 11 godzin pozostaje wartością roboczą do zewnętrznej weryfikacji prawnej i może być używana wyłącznie w trybie demonstracyjnym, dopóki nie zostanie zatwierdzona.

## `REQ-REST-WEEKLY-001` – Odpoczynek tygodniowy

Każdy wychowawca musi otrzymać wymagany, nieprzerwany odpoczynek tygodniowy zgodny z zatwierdzoną konfiguracją prawną.

Profil prawny określa co najmniej:

* `weeklyRestWindowType`: `FIXED_LOCAL_WEEK` albo `ROLLING_DURATION`,
* długość i krok okna,
* dzień i godzinę kotwicy,
* minimalny odpoczynek,
* `weeklyRestAttributionMode`: `FULLY_CONTAINED` albo `INTERSECTION_WITH_WINDOW`,
* możliwość ponownego użycia odpoczynku między oknami,
* włączenie, minimum, maksymalną liczbę i odstęp wyjątków,
* włączenie, wymiar i termin kompensacji.

Walidator buduje kołową listę maksymalnych okresów bez pracy, tworzy wszystkie okna profilu, przypisuje odpoczynek według zatwierdzonej metody, a następnie stosuje wyłącznie jawnie zatwierdzone wyjątki i kompensację.

Wartość 35 godzin pozostaje wartością roboczą do zewnętrznej weryfikacji prawnej.

## `REQ-WEEKEND-001` – Dokładny wzorzec weekendowy

W każdym tygodniu:

* dokładnie dwóch wychowawców pracuje w sobotę i niedzielę,
* trzeci ma wolne oba dni,
* para i osoba wolna odpowiadają zatwierdzonemu wariantowi,
* osobny zatwierdzony szablon określa dokładne odcinki soboty i niedzieli,
* rzeczywiste przydziały odpowiadają bez tolerancji krotkom `(dayOfWeek, sequenceNumber, educatorId, startTime, endTime)`.

Nie zakłada się tej samej godziny przekazania, tej samej kolejności osób, odwrócenia ani zakazu odwrócenia kolejności między dniami. Rozstrzyga dokładny wzorzec.

Generator nie zmienia godzin, osób, kolejności ani odcinków i nie tworzy zastępstwa. Role `RANO`, `PO_POLUDNIU` i `WOLNE` są wyłącznie etykietami prezentacyjnymi `DERIVED`.

Zatwierdzony bazowy przedział opieki placówki wynosi w sobotę i niedzielę `[06:00,22:00)`. Nie jest to przykład Codexa; musi być jawnie zapisany w planie i szablonie.

## `REQ-ROTATION-001` – Sześciotygodniowa rotacja

Cykl zawiera kolejno zatwierdzone warianty:

1. pracują A i B, C wolne,
2. pracują A i C, B wolne,
3. pracują B i C, A wolne,
4. pracują B i A, C wolne,
5. pracują C i A, B wolne,
6. pracują C i B, A wolne.

Użytkownik może wybrać pozycję początkową, ale nie zmienia kolejności zależności.

W cyklu:

* każdy wychowawca ma dwa wolne weekendy,
* każda para pracuje razem dwa razy,
* każdy tydzień odpowiada dokładnemu szablonowi właściwej pozycji.

Kolejność liter nie ustanawia roli. Pozycja tygodnia `n` wynosi:

`1 + ((startingWeekendVariant - 1 + n - 1) mod 6)`.

Jeżeli kompletny `SPECIFIC_DATE` zmienia popyt soboty albo niedzieli, wzorzec bazowy pozostaje bez zmian, jeżeli nadal pasuje dokładnie. W przeciwnym razie dane wymagają dokładnie jednego pełnego, zatwierdzonego wariantu `SUBSTITUTE` dla obu dni. Brak wariantu powoduje `INVALID_INPUT`; generator go nie tworzy.

## `REQ-CROSS-WEEK-001` – Kołowa spójność cyklu

Cykl jest powtarzalny. Wszystkie reguły odpoczynku i ciągłości są sprawdzane:

* między kolejnymi dniami,
* na każdej granicy niedziela–poniedziałek,
* między wszystkimi tygodniami,
* między tygodniem 6 a tygodniem 1 następnego cyklu.

`cycleStartDate` przypada w poniedziałek, a tydzień trwa od poniedziałku do niedzieli.

## `REQ-VALIDATOR-INDEP-001` – Niezależność walidatora

Walidator:

* ponownie oblicza zapotrzebowanie z surowych kompletnych planów,
* niezależnie normalizuje obie listy przedziałów jako zbiory,
* porównuje je z `CalculatedCareRequirement`,
* samodzielnie liczy godziny, dni, dni dzielone, odpoczynki i dokładne krotki weekendowe,
* nie ufa podsumowaniom generatora.

Rozbieżność obliczeń powoduje `INTERNAL_ERROR` i publiczny wynik `BLAD_WEWNETRZNY`.

## `REQ-LEGAL-001` – Konfiguracja prawna

Generowanie do rzeczywistego użycia wymaga statusu prawnego `VERIFIED`.

`UNVERIFIED` dopuszcza wyłącznie jawny tryb demonstracyjny z wynikiem `POPRAWNY_TRYB_DEMONSTRACYJNY`. `EXPIRED` blokuje generowanie produkcyjne.

| Profil | Tryb | Solver | Poprawny wynik |
|---|---|---:|---|
| `VERIFIED` | `PRODUCTION` | startuje | `POPRAWNY` |
| `VERIFIED` | `DEMONSTRATION` | startuje | `POPRAWNY_TRYB_DEMONSTRACYJNY` |
| `UNVERIFIED` | `PRODUCTION` | nie startuje | `DANE_NIEPOPRAWNE` |
| `UNVERIFIED` | `DEMONSTRATION` | startuje | `POPRAWNY_TRYB_DEMONSTRACYJNY` |
| `EXPIRED` | `PRODUCTION` | nie startuje | `DANE_NIEPOPRAWNE` |
| `EXPIRED` | `DEMONSTRATION` | startuje | `POPRAWNY_TRYB_DEMONSTRACYJNY` |

Wynik demonstracyjny pokazuje brak dopuszczenia do rzeczywistego użycia, status i wersję profilu oraz datę weryfikacji albo wygaśnięcia.

---

# II. REGUŁY PREFEROWANE

## `REQ-PREF-AFTERNOON-001` – Podział popołudnia

W dniu od poniedziałku do piątku uwzględnia się ciągły przedział popytu zawierający godzinę preferowaną. Brak takiego popytu albo brak podziału daje karę `0`.

`P_afternoon = Σ |handoverMinute - preferredAfternoonHandoverMinute| / timeStepMinutes`.

## `REQ-PREF-WEEKEND-SPLIT-001` – Podział weekendu

`P_weekend = Σ |assignedMinutes - preferredWeekendSplitMinutes| / timeStepMinutes`, osobno dla obu osób i obu dni.

Kara nie upoważnia do zmiany zatwierdzonego wzorca. Służy wyłącznie do raportowania albo porównania kilku zatwierdzonych wariantów `SUBSTITUTE`.

## `REQ-PREF-SPLIT-DAYS-001` – Dni dzielone

`P_splitDays = Σ max(0, segmentCount(educator, date) - 1)`.

## `REQ-PREF-LONG-SEGMENT-001` – Odcinki ponad 8 godzin

`P_longSegments = Σ max(0, durationMinutes - preferredMaximumSegmentMinutes) / timeStepMinutes`.

Odcinek dłuższy niż preferowane 8 godzin nie jest automatycznie błędem krytycznym. Prawny limit bezwzględny jest stosowany wyłącznie po zatwierdzeniu.

## `REQ-PREF-UNAVAILABLE-001` – Niedostępność preferowana

`P_preferredUnavailable` jest liczbą przypisanych slotów przecinających znormalizowane `PREFERRED`, po zastosowaniu dominacji `HARD`.

Praca w `PREFERRED` jest dozwolona wyłącznie po spełnieniu wszystkich reguł krytycznych i powoduje karę oraz ostrzeżenie.

## Łączna funkcja celu

`objectiveScore = wA × P_afternoon + wW × P_weekend + wS × P_splitDays + wL × P_longSegments + wU × P_preferredUnavailable`.

Wagi są jawnymi, nieujemnymi liczbami całkowitymi zatwierdzonej konfiguracji organizacyjnej.

Remis rozstrzyga mniejszy wektor `(P_afternoon, P_weekend, P_splitDays, P_longSegments, P_preferredUnavailable)`, a następnie kanoniczna lista `(date, startTime, endTime, educatorId)`.

---

# III. WARTOŚCI PRZYKŁADOWE

Godziny `06:00–08:00`, `14:30–22:00`, `08:00–14:30` oraz suma `79,5 godziny` nie są ukrytymi stałymi systemu.

Mogą pojawiać się jako jawna konfiguracja albo w przykładach wyraźnie oznaczonych jako demonstracyjne.

Weekendowe `[06:00,22:00)` w sobotę i niedzielę jest wyjątkiem od powyższej klasyfikacji: to jawna, zatwierdzona reguła biznesowa aktualnego wzorca placówki, nie przykład.

---

# IV. WYNIK

Harmonogram jest publikowany jako `POPRAWNY` lub `POPRAWNY_TRYB_DEMONSTRACYJNY` dopiero po wyniku walidacji `VALID`.

Przy `TIME_LIMIT` kandydat nie jest publikowany. Udowodniony brak rozwiązania zwraca `BRAK_ROZWIAZANIA` wraz z raportem konfliktu oznaczonym jako `EXACT`, `INCLUSION_MINIMAL` albo `APPROXIMATE`.
