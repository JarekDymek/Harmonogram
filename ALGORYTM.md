# ALGORYTM GENEROWANIA HARMONOGRAMU

## 1. Cel dokumentu

Generator działa jako deterministyczny solver ograniczeń dla pełnego, powtarzalnego cyklu sześciu tygodni.

Pierwsza wersja obejmuje jedną grupę i dokładnie trzech wychowawców oraz kontroluje przejście tydzień 6 → tydzień 1. Nie obejmuje ręcznej edycji, blokowania zmian, bazy danych, importu ani eksportu JSON, wielu grup ani porównania z wcześniejszym harmonogramem.

Nie występuje wychowawca rezerwowy, pula międzygrupowa ani podwójna obsada.

Generator:

* otrzymuje wyłącznie dane o statusie `VALID_INPUT`,
* nie zmienia danych wejściowych,
* spełnia wszystkie reguły krytyczne,
* ocenia wyłącznie mierzalne preferencje,
* nie uznaje własnego kandydata za poprawny,
* przekazuje wynik do niezależnego walidatora.

---

# I. PRZEBIEG OPERACJI

## 1. Etapy

1. Walidacja danych wejściowych.
2. Wybór kompletnego planu dla każdej daty.
3. Niezależna normalizacja zbiorów i dynamiczne obliczenie zapotrzebowania.
4. Sprawdzenie bilansu przydziałów godzin każdego tygodnia.
5. Utworzenie modelu ograniczeń dla sześciu tygodni.
6. Wstawienie dokładnych, zatwierdzonych przydziałów weekendowych.
7. Wyszukiwanie kandydatów.
8. Odrzucenie każdego kandydata naruszającego regułę krytyczną.
9. Ocena poprawnych kandydatów według mierzalnych preferencji.
10. Przekazanie najlepszego kandydata do niezależnego walidatora.
11. Publikacja wyniku dopiero po walidacji `VALID`.

## 2. Brak uruchomienia solvera

Solver nie uruchamia się, gdy:

* dane są niekompletne lub sprzeczne,
* dla choć jednej daty brak kompletnego planu,
* istnieją dwa zatwierdzone plany o tym samym kluczu,
* `cycleStartDate` nie przypada w poniedziałek,
* brakuje jawnego `timeZoneId` albo lokalna granica czasu jest nieistniejąca lub niejednoznaczna,
* krok jest inny niż 30 minut,
* suma obowiązujących przydziałów nie równa się popytowi tygodnia,
* cykl nie ma sześciu tygodni lub nie jest powtarzalny,
* brakuje zatwierdzonego dokładnego wzorca weekendowego albo wymaganego `SUBSTITUTE`,
* referencje mieszają wersje konfiguracji lub grupy,
* konfiguracja prawna nie pozwala na wybrany tryb działania.

Status wejścia wynosi wtedy `INVALID_INPUT`, a publiczny wynik `DANE_NIEPOPRAWNE`.

## 3. Deterministyczność

Te same:

* dane wejściowe,
* wersja konfiguracji,
* wersja algorytmu,
* wagi,
* ziarno losowości

muszą dać ten sam wynik i wynik punktowy.

Jeżeli solver korzysta z losowości, zapisuje jawne ziarno. Remisy są rozstrzygane dokładnie według wektora i kanonicznej listy krotek opisanych w sekcji funkcji celu; pozycja rekordu ani techniczna kolejność odczytu nie wpływa na wynik.

---

# II. CZAS I ZAPOTRZEBOWANIE

## 1. Sloty

Krok pierwszej wersji wynosi 30 minut. Czas jest przeliczany z `HH:MM` na minuty od północy, a następnie na indeks slotu.

Przedziały są półotwarte `[początek, koniec)`.

Odcinek:

* ma dodatnią długość,
* zaczyna się i kończy tej samej daty,
* nie przechodzi przez północ,
* zawiera co najmniej cztery sloty.

`cycleStartDate` przypada w poniedziałek, `weekStartDay = MONDAY`, a lokalna data i czas są osadzane na osi czasu według jawnego `timeZoneId`. W V1 widocznie wstępnie wybrana wartość to `Europe/Warsaw`.

## 2. Wybór kompletnego planu

Dla każdej daty generator wybiera plan z najwyższego dostępnego poziomu:

1. `SPECIFIC_DATE`,
2. `CYCLE_WEEK`,
3. `BASE_WEEKLY`.

Brak planu jest błędem `REQ-SPECIAL-DAY-001`.

Plan wyższego poziomu zastępuje cały plan niższego poziomu. Generator nie scala częściowych wyjątków.

Dla każdego klucza może istnieć najwyżej jeden zatwierdzony plan. Dla każdego dnia tygodnia istnieje dokładnie jeden zatwierdzony `BASE_WEEKLY`, a dla każdej z 42 dat dokładnie jeden skuteczny plan. Duplikat jest błędem `REQ-SPECIAL-DAY-001`; kolejność rekordów nie rozstrzyga wyboru.

## 3. Obliczenie zapotrzebowania

Dla każdej daty i grupy:

1. pobierz wszystkie godziny funkcjonowania z wybranego planu,
2. posortuj je i scal przedziały nakładające się oraz stykające,
3. pobierz pełną listę przedziałów bez wymaganej opieki i znormalizuj ją tak samo,
4. sprawdź, czy każdy okres bez opieki należy do sumy godzin funkcjonowania,
5. oblicz `union(operatingIntervals) \ union(noCareIntervals)`,
6. utwórz `RequiredCareInterval`,
7. wyprowadź `requiredStaffCount = 1`,
8. rozbij wynik na sloty,
9. oblicz `totalRequiredMinutes`,
10. zapisz źródło planu i wersję obliczenia.

`requiredStaffCount` nie należy do surowego wejścia. Jeżeli kalkulator wytworzy wartość inną niż `1`, przebieg kończy się `INTERNAL_ERROR`, publicznie `BLAD_WEWNETRZNY`, z `REQ-VALIDATOR-INDEP-001` i kontekstem `REQ-STAFFING-001`.

Nie stosuje się stałych godzin szkoły, opieki ani stałej sumy tygodniowej.

## 4. Bilans tygodnia

Dla wychowawcy i tygodnia obowiązuje:

1. zatwierdzony przydział zastępczy, jeżeli istnieje,
2. w przeciwnym razie przydział podstawowy.

Przed solverem:

`suma obowiązujących przydziałów = suma wymaganych minut tygodnia`

Brak równości powoduje `INVALID_INPUT`, nie `NO_SOLUTION`.

---

# III. ZMIENNE DECYZYJNE

## 1. Przypisanie do slotu

`pracuje[tydzien][data][slot][wychowawca] ∈ {0,1}`

Zmienna istnieje dla każdego slotu wymaganej opieki i każdego z trzech wychowawców.

## 2. Dzień pracy

`pracuje_w_dniu[data][wychowawca] ∈ {0,1}`

Wartość wynosi 1, gdy wychowawca ma co najmniej jeden slot tej daty.

## 3. Początek i koniec odcinka

Początek występuje, gdy slot jest przypisany, a poprzedni slot tej samej daty nie jest przypisany tej osobie albo nie należy do zapotrzebowania.

Koniec występuje analogicznie przy następnym slocie. Maksymalny ciąg slotów tworzy jeden odcinek.

## 4. Dokładne przydziały weekendowe

Dla każdego tygodnia zatwierdzony wzorzec ustala krotki:

`(dayOfWeek, sequenceNumber, educatorId, startTime, endTime)`.

Są to stałe ograniczenia modelu, nie zmienne do optymalizacji. Role `RANO`, `PO_POLUDNIU` i `WOLNE`, jeżeli są prezentowane, są wyłącznie `DERIVED`.

---

# IV. OGRANICZENIA KRYTYCZNE

| Rule ID | Ograniczenie solvera |
|---|---|
| `REQ-NO-GUESSING-001` | Model powstaje wyłącznie z zatwierdzonych danych; żadna wartość nie jest uzupełniana. |
| `REQ-SPECIAL-DAY-001` | Każda data ma jeden kompletny plan wybrany zgodnie z hierarchią. |
| `REQ-TIME-STEP-001` | Wszystkie granice są wielokrotnością 30 minut. |
| `REQ-TIME-SAME-DAY-001` | Każdy odcinek kończy się tej samej daty i nie przechodzi przez północ. |
| `REQ-SEGMENT-MIN-001` | Każdy odcinek ma co najmniej 120 minut. |
| `REQ-COVERAGE-001` | Każdy wymagany slot ma obsadę. |
| `REQ-STAFFING-001` | Suma przypisań w wymaganym slocie wynosi dokładnie 1. |
| `REQ-NO-OUTSIDE-001` | Nie tworzy się zmiennych/przydziałów poza wymaganymi slotami. |
| `REQ-HOURS-001` | Sloty osoby w tygodniu dają dokładnie jej obowiązujący przydział minut. |
| `REQ-DAYS-001` | Każdy wychowawca ma dokładnie 5 dat pracy w każdym tygodniu. |
| `REQ-UNAVAILABLE-HARD-001` | Slot `HARD` ma dla wychowawcy wartość 0. |
| `REQ-REST-DAILY-001` | Przerwa między ostatnim a pierwszym odcinkiem kolejnych dat spełnia zatwierdzony limit. |
| `REQ-REST-WEEKLY-001` | Każda osoba ma zatwierdzony ciągły odpoczynek tygodniowy. |
| `REQ-WEEKEND-001` | Rzeczywiste krotki soboty i niedzieli dokładnie odpowiadają zatwierdzonemu wzorcowi. |
| `REQ-ROTATION-001` | Sześć dokładnych wariantów występuje w zatwierdzonej kolejności od wybranej pozycji startowej. |
| `REQ-CROSS-WEEK-001` | Ograniczenia obejmują wszystkie granice, w tym tydzień 6 → 1. |
| `REQ-VALIDATOR-INDEP-001` | Kandydat nie otrzymuje statusu końcowego bez niezależnej walidacji. |
| `REQ-LEGAL-001` | Tryb produkcyjny wymaga `VERIFIED`; `UNVERIFIED` i `EXPIRED` dopuszczają wyłącznie jawny tryb demonstracyjny. |

## 1. Niedostępności

Przed zbudowaniem ograniczeń wpisy są normalizowane:

* zakresy są sumowane,
* wpisy tego samego typu są scalane,
* `HARD` dominuje nad `PREFERRED`.

`PREFERRED` nie tworzy ograniczenia krytycznego, lecz karę.

## 2. Dni dzielone

W wersji pierwszej dni dzielone są dopuszczalne, o ile każdy odcinek spełnia wszystkie reguły krytyczne, w szczególności `REQ-SEGMENT-MIN-001`.

Algorytm minimalizuje liczbę dni dzielonych jako mierzalną preferencję `REQ-PREF-SPLIT-DAYS-001`.

## 3. Weekendy

Warianty `BASE`:

1. pracują A i B, C wolne,
2. pracują A i C, B wolne,
3. pracują B i C, A wolne,
4. pracują B i A, C wolne,
5. pracują C i A, B wolne,
6. pracują C i B, A wolne.

Każdy wariant zawiera zatwierdzony, dokładny szablon soboty i niedzieli. Kolejność liter nie ustanawia roli godzinowej. Generator:

* wybiera pozycję `1 + ((startingWeekendVariant - 1 + weekNumber - 1) mod 6)`,
* kopiuje dokładne przydziały szablonu jako ustalone wartości,
* nie zmienia godziny, osoby, kolejności ani odcinka,
* nie tworzy zastępstwa,
* nie używa kary `P_weekend` do zmiany wzorca.

Wszyscy trzej wychowawcy są dopuszczeni do pracy weekendowej. Zbiór dwóch pracujących i `offEducatorId` tworzy dokładnie zbiór trzech aktywnych wychowawców grupy.

Zatwierdzony bazowy popyt placówki wynosi `[06:00,22:00)` w sobotę i niedzielę.

Jeżeli `SPECIFIC_DATE` zmienia weekendowy popyt, generator zachowuje wariant bazowy, jeśli nadal pasuje dokładnie. W przeciwnym razie walidacja wejścia wymaga dokładnie jednego zatwierdzonego `SUBSTITUTE` z pełnymi szablonami obu dni. Wariant zastępczy nie zmienia pozycji rotacji bazowej.

---

# V. KOŁOWA ANALIZA ODPOCZYNKÓW

Cykl zawiera 42 daty.

Dla każdej osoby odcinki są sortowane chronologicznie. Po ostatnim odcinku tygodnia 6 następuje pierwszy odcinek tygodnia 1 w kolejnym powtórzeniu cyklu.

Sortowanie używa chwil na osi czasu utworzonej z lokalnej daty, czasu i `timeZoneId`. Odpoczynek jest rzeczywistą liczbą minut, również przy zmianie czasu urzędowego.

Sprawdzane są:

* wszystkie kolejne odcinki,
* ostatni odcinek daty i pierwszy odcinek następnej daty,
* wszystkie granice niedziela–poniedziałek,
* granica tygodnia 6 i tygodnia 1,
* ciągłe okna odpoczynku tygodniowego zgodnie z konfiguracją prawną.

Dla odpoczynku tygodniowego generator:

1. tworzy kołową listę maksymalnych okresów bez pracy,
2. tworzy wszystkie okna według `weeklyRestWindowType`, długości, kroku i kotwicy,
3. przypisuje odpoczynek według `weeklyRestAttributionMode`,
4. respektuje `weeklyRestReuseAcrossWindowsAllowed`,
5. stosuje wyłącznie zatwierdzony zakres wyjątków i kompensacji.

---

# VI. GENEROWANIE KANDYDATÓW

## 1. Kolejność

1. Ustal warianty weekendowe.
2. Wstaw dokładne przydziały zatwierdzonych wzorców.
3. Ustal dni pracy i wolne, zachowując dokładnie pięć dni.
4. Rozpatruj sloty z najmniejszą liczbą dostępnych wychowawców.
5. Rozpatruj granice wpływające na odpoczynek.
6. Uzupełnij pozostałe sloty.

Solver stosuje zasadę najbardziej ograniczonej zmiennej i cofa decyzje prowadzące do konfliktu. Nigdy nie łagodzi ograniczeń krytycznych.

## 2. Limit czasu

Statusy przebiegu:

* `NOT_STARTED`,
* `RUNNING`,
* `CANDIDATE_FOUND`,
* `NO_SOLUTION`,
* `TIME_LIMIT`,
* `INTERNAL_ERROR`.

Przy `TIME_LIMIT`:

* publiczny wynik brzmi `NIE_ZAKONCZONO_WYSZUKIWANIA`,
* status dotyczy wyłącznie braku kandydata spełniającego wymagane warunki,
* istniejący kandydat przechodzi niezależną kontrolę; wynik `VALID` wystarcza do publikacji poprawnej propozycji bez dowodu optymalności.

Domyślny model zawiera tylko wymagane ograniczenia i kończy szukanie po pierwszym rozwiązaniu. Zmienne oceny preferencji są budowane dopiero na żądanie opcjonalnego ulepszania. PWA przechowuje dotychczasowy poprawny plan, jeżeli ulepszanie nie dostarczy lepszego poprawnego wyniku.

---

# VII. FUNKCJA OCENY

Ocena jest wykonywana dopiero po spełnieniu wszystkich reguł krytycznych.

Niższy wynik oznacza lepszy harmonogram.

| Rule ID | Kara |
|---|---|
| `REQ-PREF-AFTERNOON-001` | `P_afternoon = Σ abs(handoverMinute - preferredAfternoonHandoverMinute) / timeStepMinutes`. |
| `REQ-PREF-WEEKEND-SPLIT-001` | `P_weekend = Σ abs(assignedMinutes - preferredWeekendSplitMinutes) / timeStepMinutes` dla obu osób i dni. |
| `REQ-PREF-SPLIT-DAYS-001` | `P_splitDays = Σ max(0, segmentCount(educator,date) - 1)`. |
| `REQ-PREF-LONG-SEGMENT-001` | `P_longSegments = Σ max(0, durationMinutes - preferredMaximumSegmentMinutes) / timeStepMinutes`. |
| `REQ-PREF-UNAVAILABLE-001` | `P_preferredUnavailable` = liczba przydzielonych slotów przecinających znormalizowane `PREFERRED`. |

Dla `P_afternoon` uwzględnia się roboczy ciągły przedział popytu zawierający godzinę preferowaną; brak takiego popytu albo brak podziału daje `0`.

Łączny wynik:

`objectiveScore = wA × P_afternoon + wW × P_weekend + wS × P_splitDays + wL × P_longSegments + wU × P_preferredUnavailable`.

Wagi są jawnymi, nieujemnymi liczbami całkowitymi zatwierdzonej konfiguracji.

`P_weekend` służy wyłącznie do raportowania albo porównania kilku zatwierdzonych `SUBSTITUTE`; nie modyfikuje wzorca.

Pierwsza wersja nie ocenia prostoty, czytelności, łatwości zapamiętania, regularności bez wzoru ani stabilności względem poprzedniej wersji.

Remis rozstrzyga wektor `(P_afternoon, P_weekend, P_splitDays, P_longSegments, P_preferredUnavailable)`, a następnie kanoniczna lista `(date, startTime, endTime, educatorId)`.

---

# VIII. BRAK ROZWIĄZANIA I RAPORT KONFLIKTU

`NO_SOLUTION` oznacza matematycznie potwierdzony brak harmonogramu spełniającego wszystkie ograniczenia.

Publiczny wynik brzmi `BRAK_ROZWIAZANIA`.

Raport zawiera:

* `conflictingRuleIds`,
* wychowawców,
* daty,
* przedziały,
* wartości wymagane i faktyczne,
* pola wejściowe do sprawdzenia,
* `conflictAnalysisQuality`.

Dozwolone wartości jakości:

* `EXACT`,
* `INCLUSION_MINIMAL`,
* `APPROXIMATE`.

Pierwsza wersja nie musi gwarantować najmniejszej liczby elementów konfliktu. Raport `APPROXIMATE` nie może być przedstawiany jako matematycznie minimalny.

---

# IX. NIEZALEŻNA WALIDACJA

Po znalezieniu kandydata walidator:

1. osobno normalizuje zbiory i ponownie oblicza zapotrzebowanie z surowych planów,
2. porównuje je z wynikiem kalkulatora,
3. samodzielnie wylicza wszystkie pola pochodne,
4. porównuje dokładne krotki weekendowe z zatwierdzonymi szablonami,
5. sprawdza reguły krytyczne w całym kołowym cyklu,
6. generuje ostrzeżenia preferencji.

Rozbieżność kalkulatora i walidatora albo naruszenie krytyczne kandydata powoduje `INTERNAL_ERROR` i `BLAD_WEWNETRZNY`.

Status walidacji:

* `NOT_VALIDATED`,
* `VALID`,
* `INVALID`.

---

# X. PSEUDOKOD

```text
function generujCykl(dane):
    statusWejscia, bledy = walidujDaneWejsciowe(dane)
    if statusWejscia == INVALID_INPUT:
        return DANE_NIEPOPRAWNE + bledy

    tryb = okreslTrybPrawny(dane.legalRules)
    if tryb == ZABLOKOWANY:
        return DANE_NIEPOPRAWNE + raportKonfiguracjiPrawnej

    plany = wybierzKompletnePlanyDla42Dat(dane)
    zapotrzebowanie = obliczZapotrzebowanie(plany)

    if !bilansTygodniJestDokladny(zapotrzebowanie, dane.przydzialy):
        return DANE_NIEPOPRAWNE + raportBilansu

    model = utworzModelOgraniczen(dane, zapotrzebowanie)
    wstawDokladneWzorceWeekendowe(model, dane.weekendTemplates)
    dodajOgraniczeniaKrytyczne(model)
    if opcjonalneUlepszanie:
        dodajMierzalnePreferencje(model)

    wynik = uruchomSolver(model)

    if wynik.status == NO_SOLUTION:
        return BRAK_ROZWIAZANIA + raportKonfliktu

    if wynik.status == TIME_LIMIT:
        # TIME_LIMIT występuje tu tylko bez kandydata.
        return NIE_ZAKONCZONO_WYSZUKIWANIA + raportDzialania

    if wynik.status == INTERNAL_ERROR:
        return BLAD_WEWNETRZNY + raportDzialania

    kandydat = wynik.kandydat
    raport = niezaleznyWalidator(kandydat, dane, zapotrzebowanie)

    if raport.status == INVALID:
        return BLAD_WEWNETRZNY + raport

    if tryb == DEMONSTRACYJNY:
        return POPRAWNY_TRYB_DEMONSTRACYJNY + kandydat + raport

    return POPRAWNY + kandydat + raport
```

Funkcja `okreslTrybPrawny` stosuje tabelę:

| Profil | Tryb | Wynik bramki |
|---|---|---|
| `VERIFIED` | `PRODUCTION` | produkcyjny |
| `VERIFIED` | `DEMONSTRATION` | demonstracyjny |
| `UNVERIFIED` | `PRODUCTION` | zablokowany |
| `UNVERIFIED` | `DEMONSTRATION` | demonstracyjny |
| `EXPIRED` | `PRODUCTION` | zablokowany |
| `EXPIRED` | `DEMONSTRATION` | demonstracyjny |

Każdy wynik demonstracyjny pokazuje brak dopuszczenia do rzeczywistego użycia, status i wersję profilu oraz datę weryfikacji albo wygaśnięcia.

---

# XI. REJESTR IDENTYFIKATORÓW

Reguły krytyczne:

`REQ-NO-GUESSING-001`, `REQ-SPECIAL-DAY-001`, `REQ-TIME-STEP-001`, `REQ-TIME-SAME-DAY-001`, `REQ-SEGMENT-MIN-001`, `REQ-COVERAGE-001`, `REQ-STAFFING-001`, `REQ-NO-OUTSIDE-001`, `REQ-HOURS-001`, `REQ-DAYS-001`, `REQ-UNAVAILABLE-HARD-001`, `REQ-REST-DAILY-001`, `REQ-REST-WEEKLY-001`, `REQ-WEEKEND-001`, `REQ-ROTATION-001`, `REQ-CROSS-WEEK-001`, `REQ-VALIDATOR-INDEP-001`, `REQ-LEGAL-001`.

Preferencje:

`REQ-PREF-AFTERNOON-001`, `REQ-PREF-WEEKEND-SPLIT-001`, `REQ-PREF-SPLIT-DAYS-001`, `REQ-PREF-LONG-SEGMENT-001`, `REQ-PREF-UNAVAILABLE-001`.
