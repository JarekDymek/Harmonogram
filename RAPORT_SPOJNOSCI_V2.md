# RAPORT SPÓJNOŚCI V2

## 0. Podsumowanie wykonawcze

**Data audytu:** 2026-07-23  
**Końcowa ocena:** `NIEGOTOWA DO PROJEKTOWANIA IMPLEMENTACJI`

| Miara | Wynik |
|---|---:|
| Problemy krytyczne | 0 |
| Problemy wysokie | 6 |
| Problemy średnie | 5 |
| Problemy niskie | 0 |
| Pierwotne problemy `ROZWIAZANY` | 29 |
| Pierwotne problemy `CZESCIOWO_ROZWIAZANY` | 2 |
| Pierwotne problemy `NIEROZWIAZANY` | 0 |
| Pierwotne problemy `ZASTAPIONY_NOWYM_PROBLEMEM` | 1 |
| Nowe problemy `V2-P-*` | 11 |

Dokumentacja jest znacznie bardziej spójna niż wersja oceniona w `RAPORT_SPOJNOSCI.md`. Wszystkie decyzje `DP-001`–`DP-040` są widoczne w dokumentach na poziomie polityki projektowej, lecz część z nich nie została jeszcze doprowadzona do definicji wystarczającej do jednoznacznej implementacji.

Nie stwierdzono ponownego pojawienia się pierwotnych sprzeczności krytycznych dotyczących stałych godzin opieki, kroku czasu, liczby dni, bilansu godzin, weekendów, statusów ani niezależności walidatora.

Status gotowości jest negatywny z powodu sześciu problemów wysokich blokujących jednoznaczne zaprojektowanie modelu czasu, solvera lub pełnego zestawu wykonywalnych testów.

---

# I. Zakres i metoda audytu

Przeczytano w całości aktualne wersje:

* `SPECYFIKACJA.md`,
* `ZASADY.md`,
* `WALIDACJA.md`,
* `DANE_WEJSCIOWE.md`,
* `ALGORYTM.md`,
* `MODEL_DANYCH.md`,
* `TESTY_I_SCENARIUSZE.md`,
* `DECYZJE_PROJEKTOWE.md`,
* `CHANGELOG_DOKUMENTACJI.md`,
* pierwotny `RAPORT_SPOJNOSCI.md`.

`DECYZJE_PROJEKTOWE.md` przyjęto jako źródło autorytatywne. Pierwotny raport potraktowano jako dokument historyczny służący do porównania problemów `P-001`–`P-032`.

Audyt objął:

1. zakres pierwszej wersji,
2. każdą decyzję `DP-001`–`DP-040`,
3. każdy problem `P-001`–`P-032`,
4. wszystkie reguły krytyczne i preferowane,
5. statusy wejścia, solvera, walidatora i wyniku publicznego,
6. model danych i integralność relacji,
7. testy dodatnie, ujemne i integracyjne,
8. oddzielenie kwestii prawnych od problemów dokumentacyjnych,
9. możliwość przełożenia dokumentów na kod bez zgadywania.

Automatyczna kontrola rejestru wykazała:

* 23 identyczne `ruleId` w każdym z siedmiu aktywnych dokumentów merytorycznych,
* 18 reguł krytycznych,
* 5 reguł preferowanych,
* 18 wierszy macierzy testów krytycznych,
* co najmniej jeden wskazany test dodatni i ujemny dla każdej reguły krytycznej,
* 91 wierszy scenariuszy testowych,
* tylko 14 scenariuszy odwołujących się bezpośrednio do nazwanej kompletnej bazy `FIX-*`.

---

# II. Weryfikacja decyzji `DP-001`–`DP-040`

Status `WDROZONA_CZESCIOWO` oznacza, że rozstrzygnięcie zostało zapisane, ale jego operacyjna definicja nadal wymaga doprecyzowania przed kodowaniem.

| Decyzja | Status | Ocena wdrożenia |
|---|---|---|
| `DP-001` | `WDROZONA` | Wynikiem jest pełny, kołowy cykl sześciu tygodni dla jednej grupy i trzech wychowawców. |
| `DP-002` | `WDROZONA` | Ręczna edycja, blokady, JSON, baza danych, wiele grup i porównanie z poprzednim harmonogramem są poza V1. |
| `DP-003` | `WDROZONA` | Zapotrzebowanie jest wyliczane osobno dla każdej daty. Wartości godzin są przykładami. |
| `DP-004` | `WDROZONA` | Profil bazowy jest jawny, kompletny i zatwierdzany. Nie ma ukrytego poziomu domyślnego. |
| `DP-005` | `WDROZONA` | Wyjątek daty jest kompletnym planem zastępującym niższy poziom. |
| `DP-006` | `WDROZONA_CZESCIOWO` | Hierarchia trzech poziomów jest zgodna, ale wybór nie jest jednoznaczny przy kilku zatwierdzonych planach tego samego poziomu; zob. `V2-P-001`. |
| `DP-007` | `WDROZONA` | Jedynym krokiem V1 jest 30 minut. |
| `DP-008` | `WDROZONA` | Minimalny odcinek V1 wynosi 120 minut. |
| `DP-009` | `WDROZONA` | Odcinki przez północ są zabronione, a pracownicy nocni są poza zakresem. |
| `DP-010` | `WDROZONA` | Jedynym źródłem liczby dni jest globalna konfiguracja z wartością 5. |
| `DP-011` | `WDROZONA` | Każdy wychowawca ma podstawowy przydział tygodniowy. |
| `DP-012` | `WDROZONA` | Istnieje jawny, zatwierdzony override dla osoby i tygodnia. Generator go nie tworzy. |
| `DP-013` | `WDROZONA` | Niezgodny bilans daje `INVALID_INPUT` i nie uruchamia solvera. |
| `DP-014` | `WDROZONA_CZESCIOWO` | Reguły weekendowe są krytyczne, ale pojęcie roli wcześniejszej/późniejszej nie jest kompletne dla dowolnego dynamicznego popytu; zob. `V2-P-004`. |
| `DP-015` | `WDROZONA` | Sześć wariantów i możliwość wyboru pozycji startowej zapisano zgodnie z decyzją. |
| `DP-016` | `WDROZONA_CZESCIOWO` | Podział 8 + 8 jest preferencją, lecz wzór kary nie jest całkowicie jednoznaczny; zob. `V2-P-009`. |
| `DP-017` | `WDROZONA` | Cała trójka musi być dopuszczona do pracy weekendowej. |
| `DP-018` | `WDROZONA` | `HARD` jest regułą krytyczną. |
| `DP-019` | `WDROZONA` | `PREFERRED` jest preferencją z karą i ostrzeżeniem. |
| `DP-020` | `WDROZONA` | Niedostępności są sumowane, scalane, a `HARD` dominuje nad `PREFERRED`. |
| `DP-021` | `WDROZONA_CZESCIOWO` | Dokładnie jedna osoba jest jedyną regułą obsady, ale pochodne `requiredStaffCount` otrzymuje status błędu wejścia zamiast błędu modułu; zob. `V2-P-007`. |
| `DP-022` | `WDROZONA_CZESCIOWO` | Cykl 6 → 1 jest sprawdzany, lecz brakuje kotwicy tygodnia i strefy czasowej; zob. `V2-P-002`, `V2-P-003`, `V2-P-005`. |
| `DP-023` | `WDROZONA` | Walidator ponownie liczy popyt i pola pochodne z surowych danych. |
| `DP-024` | `WDROZONA_CZESCIOWO` | Produkcja wymaga `VERIFIED`, a `UNVERIFIED` pozwala tylko na demo. Nie określono zachowania demo dla `EXPIRED`; zob. `V2-P-011`. |
| `DP-025` | `WDROZONA` | Model zawiera wymagany ślad prawny. |
| `DP-026` | `WDROZONA` | Wartości 11 i 35 godzin są robocze; dokumentacja nie uznaje ich samodzielnie za zatwierdzone prawnie. |
| `DP-027` | `WDROZONA` | Statusy walidacji wejścia są rozdzielone i kompletne. |
| `DP-028` | `WDROZONA` | Statusy przebiegu solvera są rozdzielone i kompletne. |
| `DP-029` | `WDROZONA` | Statusy walidacji harmonogramu są rozdzielone. |
| `DP-030` | `WDROZONA` | Publiczne wyniki są zapisane jako osobny zbiór. |
| `DP-031` | `WDROZONA` | `TIME_LIMIT` nie publikuje kandydata i nie oznacza braku rozwiązania. |
| `DP-032` | `WDROZONA` | Wszystkie dokumenty używają wspólnego rejestru stabilnych `ruleId`. |
| `DP-033` | `WDROZONA` | Raport konfliktu ma `conflictAnalysisQuality` z trzema zatwierdzonymi wartościami. |
| `DP-034` | `WDROZONA` | Relacja dziecko → rodzic jest źródłem autorytatywnym; pozostało ryzyko spójności wersji, opisane w `V2-P-010`. |
| `DP-035` | `WDROZONA` | Pola pochodne są oznaczone `DERIVED` i mają być przeliczane przez walidator. |
| `DP-036` | `WDROZONA` | Dane wpływające na zapotrzebowanie zawierają `groupId`. |
| `DP-037` | `WDROZONA` | Wydarzenia mają `eventType`, `customEventType` i `description`. |
| `DP-038` | `WDROZONA_CZESCIOWO` | Pozostawiono pięć mierzalnych preferencji, lecz nie wszystkie wzory i przypadki wieloprzedziałowe są jednoznaczne; zob. `V2-P-009`. |
| `DP-039` | `WDROZONA` | Niemierzalne preferencje usunięto z V1. |
| `DP-040` | `WDROZONA` | Aktywny plik i aktywne odwołania używają `SPECYFIKACJA.md`. Stara pisownia pozostaje jedynie w zachowanym raporcie historycznym. |

**Wniosek:** decyzje są wdrożone na poziomie kierunku projektowego, ale `DP-006`, `DP-014`, `DP-016`, `DP-021`, `DP-022`, `DP-024` i `DP-038` nie są jeszcze wystarczająco operacyjne dla implementacji bez zgadywania.

---

# III. Status problemów `P-001`–`P-032`

Skróty plików:

* `S` – `SPECYFIKACJA.md`,
* `Z` – `ZASADY.md`,
* `W` – `WALIDACJA.md`,
* `D` – `DANE_WEJSCIOWE.md`,
* `A` – `ALGORYTM.md`,
* `M` – `MODEL_DANYCH.md`,
* `T` – `TESTY_I_SCENARIUSZE.md`.

| Problem | Status | Decyzje | Pliki | Uzasadnienie | Pozostałe ryzyko |
|---|---|---|---|---|---|
| `P-001` | `ROZWIAZANY` | `DP-003`–`DP-006` | S, Z, W, D, A, M, T | Stałe godziny usunięto; popyt powstaje z kompletnego planu każdej daty. | Niejednoznaczność duplikatów planów i nakładających się godzin: `V2-P-001`, `V2-P-008`. |
| `P-002` | `ROZWIAZANY` | `DP-007` | Z, W, D, A, M, T | Wszystkie warstwy dopuszczają wyłącznie 30 minut. | Brak. |
| `P-003` | `ROZWIAZANY` | `DP-024`–`DP-026` | S, Z, W, D, A, M, T | Wprowadzono `UNVERIFIED`, `VERIFIED`, `EXPIRED`, tryb demo i blokadę produkcji. | Zewnętrzna weryfikacja prawa oraz `V2-P-011`. |
| `P-004` | `ROZWIAZANY` | `DP-011`–`DP-013` | Z, W, D, A, M, T | Model zawiera przydział bazowy i zatwierdzony override tygodnia; bilans jest sprawdzany przed solverem. | Brak. |
| `P-005` | `ROZWIAZANY` | `DP-005`–`DP-006` | Z, W, D, A, M, T | Wyjątek daty jest kompletnym planem i zastępuje cały niższy poziom. | Kilka planów tego samego poziomu: `V2-P-001`. |
| `P-006` | `ROZWIAZANY` | `DP-010` | Z, W, D, A, M, T | `requiredWorkDaysPerWeek = 5` istnieje wyłącznie w konfiguracji organizacyjnej. | Brak. |
| `P-007` | `ROZWIAZANY` | `DP-001`, `DP-022` | S, Z, W, D, A, M, T | `cycleIsRepeating = true`, a kontrola obejmuje tydzień 6 → 1. | Kotwica tygodnia, strefa czasowa i okno odpoczynku: `V2-P-002`, `V2-P-003`, `V2-P-005`. |
| `P-008` | `ROZWIAZANY` | `DP-023` | S, Z, W, A, M, T | Walidator ponownie liczy popyt z surowych planów i porównuje z kalkulatorem. | Brak. |
| `P-009` | `ROZWIAZANY` | `DP-014`, `DP-018`, `DP-019`, `DP-038` | Z, W, A, M, T | Zlikwidowano klasę „WYSOKI”; reguły są krytyczne albo preferowane. | Brak. |
| `P-010` | `ROZWIAZANY` | `DP-014` | Z, W, A, T | Zakaz odwrócenia ról między sobotą i niedzielą jest bezwarunkowy. | Dokładne mapowanie roli na dynamiczny popyt: `V2-P-004`. |
| `P-011` | `ROZWIAZANY` | `DP-017` | Z, D, A, M, T | `canWorkWeekends=false` jest niedozwolone; model nie wymaga tego pola. | Brak. |
| `P-012` | `ROZWIAZANY` | `DP-013`, `DP-027`, `DP-030` | S, Z, D, A, M, T | Niezgodny bilans jednoznacznie daje `INVALID_INPUT` i `DANE_NIEPOPRAWNE`. | Brak. |
| `P-013` | `ROZWIAZANY` | `DP-031` | S, Z, A, M, T | Limit czasu ma osobny status; kandydat pozostaje diagnostyczny. | Brak. |
| `P-014` | `ROZWIAZANY` | `DP-008` | Z, W, D, A, M, T | 120 minut jest stałą V1, nawet jeżeli pole pozostaje technicznie w modelu. | Brak. |
| `P-015` | `ZASTAPIONY_NOWYM_PROBLEMEM` | `DP-021` | Z, W, D, A, M, T | Konkurencyjne źródła obsady usunięto i pozostawiono dokładnie jedną osobę. | Pole jest teraz `DERIVED`, ale wartość 2 klasyfikuje się jako `INVALID_INPUT`; zob. `V2-P-007`. |
| `P-016` | `ROZWIAZANY` | `DP-025` | S, W, D, M, T | `LegalRulesConfiguration` zawiera jurysdykcję, źródło, daty, zatwierdzenie, wersję i status. | Zewnętrzna prawidłowość źródła nadal wymaga weryfikacji. |
| `P-017` | `ROZWIAZANY` | `DP-034` | D, M | Dziecko wskazuje rodzica, a tablice dzieci nie są drugim źródłem prawdy. | Zgodność wersji i grup między wieloma referencjami: `V2-P-010`. |
| `P-018` | `ROZWIAZANY` | `DP-032` | S, Z, W, D, A, M, T | Wszystkie dokumenty zawierają ten sam zestaw 23 identyfikatorów. | Brak. |
| `P-019` | `ROZWIAZANY` | `DP-033` | Z, A, M, T | Raport rozróżnia `EXACT`, `INCLUSION_MINIMAL` i `APPROXIMATE`. | Brak. |
| `P-020` | `ROZWIAZANY` | `DP-020` | Z, W, D, A, M, T | Zakresy są sumowane, wpisy scalane, a `HARD` dominuje. | Brak. |
| `P-021` | `ROZWIAZANY` | `DP-001`, `DP-002` | S, Z, W, D, A, M, T | V1 jednoznacznie generuje cały cykl i wyłącza funkcje przyszłe. | Brak. |
| `P-022` | `ROZWIAZANY` | ujednolicenie dokumentacji | S, Z, W, D, A, M, T | `SPECYFIKACJA.md` zawiera słownik slotu, przedziału, odcinka, dnia, planu, popytu i harmonogramu. | Brak. |
| `P-023` | `ROZWIAZANY` | `DP-037` | D, M, T | Zastosowano kontrolowane `eventType` oraz `customEventType`. | Brak. |
| `P-024` | `ROZWIAZANY` | `DP-005`, `DP-006` | D, M | Zakres znajduje się na kompletnym `DayCarePlan`; dzieci dziedziczą kontekst planu. | Unikalność planu dla klucza zakresu: `V2-P-001`. |
| `P-025` | `ROZWIAZANY` | `DP-036` | D, M | Plan, godziny, przerwy, popyt i wymagane przedziały zawierają `groupId`. | Zgodność wszystkich referencji z tą samą grupą: `V2-P-010`. |
| `P-026` | `ROZWIAZANY` | `DP-009` | Z, W, D, A, M, T | Zakaz przejścia przez północ jest jawny w każdej warstwie. | Strefa czasowa odpoczynków między datami: `V2-P-003`. |
| `P-027` | `ROZWIAZANY` | `DP-002` | S, Z, W, D, A, M, T | `MANUAL`, `locked`, JSON i porównanie z poprzednim wynikiem nie należą do V1. | Brak. |
| `P-028` | `ROZWIAZANY` | `DP-035` | W, A, M, T | Pola pochodne mają oznaczenie `DERIVED` i podlegają ponownemu obliczeniu. | Klasyfikacja błędu pochodnego `requiredStaffCount`: `V2-P-007`. |
| `P-029` | `ROZWIAZANY` | `DP-027`–`DP-030` | S, W, D, A, M, T | Statusy wejścia, solvera, walidacji i wyniku publicznego są rozdzielone. | Zachowanie `EXPIRED` w demo i błąd pola pochodnego: `V2-P-007`, `V2-P-011`. |
| `P-030` | `CZESCIOWO_ROZWIAZANY` | aktualizacja testów | T, W | Dodano fixture cyklu, brakujące przypadki, statusy, wartości i macierz testów. | Wiele testów cząstkowych używa globalnego `VALID/INVALID` bez kompletnego kontekstu; zob. `V2-P-006`. |
| `P-031` | `CZESCIOWO_ROZWIAZANY` | `DP-038`, `DP-039` | S, Z, W, D, A, M, T | Niemierzalne preferencje usunięto, a pięć dozwolonych otrzymało liczniki i wagi. | Niepełne wzory dla weekendu, popołudnia i agregacji celu; zob. `V2-P-009`. |
| `P-032` | `ROZWIAZANY` | `DP-040` | wszystkie aktywne dokumenty | Nazwa aktywnego pliku i aktywne odwołania to `SPECYFIKACJA.md`. | Stara pisownia występuje tylko w niezmienionym raporcie historycznym. |

---

# IV. Nowe problemy

## `V2-P-001` – Niejednoznaczny wybór planu tego samego poziomu

**Ważność:** WYSOKI  
**Pliki i sekcje:** `ZASADY.md` `REQ-SPECIAL-DAY-001`; `DANE_WEJSCIOWE.md` III.1–III.2 i VIII.8; `ALGORYTM.md` II.2; `MODEL_DANYCH.md` V.1 i X; `TESTY_I_SCENARIUSZE.md` III.

**Opis:** Dokumentacja nakazuje wybrać „pierwszy kompletny plan” według poziomu `SPECIFIC_DATE`, `CYCLE_WEEK`, `BASE_WEEKLY`, ale nie ustanawia unikalności zatwierdzonego planu dla klucza:

* wersja konfiguracji,
* grupa,
* zakres,
* data albo para tydzień–dzień tygodnia albo dzień tygodnia.

Nie określono też kolejności wyboru, gdy dwa kompletne plany tego samego poziomu są zatwierdzone.

**Konsekwencje:** Kalkulator i niezależny walidator mogą wybrać różne plany albo implementator może wprowadzić arbitralne sortowanie. Popyt, bilans i wynik harmonogramu przestają być deterministyczne.

**Wymagane działanie:** Dodać ograniczenie dokładnie jednego zatwierdzonego planu na klucz, regułę `INVALID_INPUT` dla duplikatów oraz test dodatni i ujemny. Nie używać nieokreślonego „pierwszego” rekordu.

## `V2-P-002` – Brak jednoznacznej kotwicy tygodnia

**Ważność:** WYSOKI  
**Pliki i sekcje:** `SPECYFIKACJA.md` 2; `ZASADY.md` `REQ-CROSS-WEEK-001`; `WALIDACJA.md` IV; `DANE_WEJSCIOWE.md` I.1; `ALGORYTM.md` V; `MODEL_DANYCH.md` `ScheduleConfigurationVersion`, `ScheduleWeek`; `TESTY_I_SCENARIUSZE.md` `FIX-INPUT-VALID`.

**Opis:** Dokumenty wymagają kontroli granic niedziela–poniedziałek, ale nie stwierdzają, że `cycleStartDate` musi przypadać w poniedziałek ani nie definiują innej formalnej reguły początku tygodnia. Jedyny konkretny fixture zaczyna się w poniedziałek, co nie ustanawia walidowanej reguły danych.

**Konsekwencje:** Dla cyklu rozpoczynającego się we wtorek lub niedzielę numer tygodnia, weekend wariantu, pięć dni pracy i przejście 6 → 1 mogą zostać policzone różnie.

**Wymagane działanie:** Wymagać poniedziałku jako `cycleStartDate` albo dodać jawny `weekStartDay` z jedyną dozwoloną wartością V1. Dodać test daty startowej niezgodnej z kotwicą.

## `V2-P-003` – Brak strefy czasowej i reguły zmiany czasu

**Ważność:** WYSOKI  
**Pliki i sekcje:** `MODEL_DANYCH.md` I.1, `ScheduleConfigurationVersion`, `WorkAssignment`; `ZASADY.md` reguły odpoczynku; `WALIDACJA.md` `REQ-REST-DAILY-001` i `REQ-REST-WEEKLY-001`; `ALGORYTM.md` V; `TESTY_I_SCENARIUSZE.md` fixture datowany.

**Opis:** Model przechowuje datę i lokalne `HH:MM`, ale nie przechowuje strefy czasowej ani nie rozstrzyga, czy odpoczynek jest liczony jako rzeczywisty czas trwania, czy różnica czasu ściennego. Cykl może przecinać zmianę czasu urzędowego.

**Konsekwencje:** Generator i walidator mogą wyliczyć różną liczbę minut odpoczynku dla tych samych lokalnych godzin. Nie da się zagwarantować niezależności ani zgodności profilu prawnego.

**Wymagane działanie:** Dodać strefę IANA do projektu lub wersji konfiguracji, zdefiniować konwersję lokalnej daty i czasu do osi czasu oraz dodać testy przejścia na czas letni i zimowy.

## `V2-P-004` – Niepełna semantyka ról weekendowych przy dynamicznym popycie

**Ważność:** WYSOKI  
**Pliki i sekcje:** `ZASADY.md` `REQ-WEEKEND-001`; `WALIDACJA.md` `REQ-WEEKEND-001`; `ALGORYTM.md` III.4 i IV.3; `MODEL_DANYCH.md` `WeekendRotationVariant`; `TESTY_I_SCENARIUSZE.md` VIII.

**Opis:** Role `RANO` i `PO_POLUDNIU` są krytyczne, ale nie określono:

* czy w każdym dniu weekendowym istnieje dokładnie jedno przekazanie,
* czy każda osoba może mieć tylko jeden odcinek weekendowego dnia,
* jak role stosuje się do kilku rozłącznych przedziałów popytu,
* co oznacza „wcześniejsza” i „późniejsza” część, gdy zapotrzebowanie ma trzy lub więcej części,
* czy granica ról w sobotę i niedzielę musi być ta sama.

**Konsekwencje:** Dwa solvery mogą wygenerować różne, formalnie zgodne interpretacje tej samej rotacji. Walidator nie ma kompletnego kryterium odtworzenia roli.

**Wymagane działanie:** Zdefiniować formalny podział uporządkowanej listy weekendowych slotów, liczbę dopuszczalnych przekazań i warunki odcinków dla obu ról. Dodać testy popytu rozłącznego i więcej niż jednego przekazania.

## `V2-P-005` – Niepełna definicja odpoczynku tygodniowego

**Ważność:** WYSOKI  
**Pliki i sekcje:** `ZASADY.md` `REQ-REST-WEEKLY-001`; `WALIDACJA.md` `REQ-REST-WEEKLY-001`; `ALGORYTM.md` V; `MODEL_DANYCH.md` `LegalRulesConfiguration`; `TESTY_I_SCENARIUSZE.md` T-053–T-055.

**Opis:** Znana jest minimalna liczba minut, ale nie zdefiniowano:

* okna odniesienia: tydzień kalendarzowy, każdy blok cyklu czy ruchome siedem dni,
* sposobu przypisania odpoczynku przecinającego granicę dwóch tygodni,
* czy jeden długi odpoczynek może spełnić wymaganie dwóch tygodni,
* warunków użycia `weeklyRestExceptionEnabled`,
* zakresu i częstotliwości wyjątku.

Test T-053 sprawdza jedynie najdłuższą przerwę w kołowej liście, nie pełną regułę przypisania odpoczynku do każdego tygodnia.

**Konsekwencje:** Reguła krytyczna nie może zostać zakodowana ani przetestowana bez przyjęcia dodatkowej interpretacji.

**Wymagane działanie:** Po zewnętrznej weryfikacji dodać do profilu prawnego strukturalny typ okna odniesienia i warunki wyjątku. Opisać dokładny algorytm kołowy i testy granic tygodni.

## `V2-P-006` – Testy cząstkowe używają statusów całego systemu

**Ważność:** WYSOKI  
**Pliki i sekcje:** `TESTY_I_SCENARIUSZE.md` II–XIV, w szczególności T-005–T-007, T-024–T-035, T-040–T-055, T-060–T-076; porównawczo `WALIDACJA.md` I i VII.

**Opis:** Statusy `VALID` i `INVALID` są zdefiniowane jako wynik walidacji pełnego harmonogramu, ale liczne testy podają tylko jeden przedział, jedną osobę albo jedną regułę i nie odwołują się do kompletnego fixture. Dokument nie rozróżnia:

* testu jednostkowego kalkulatora,
* testu pojedynczej reguły walidatora,
* walidacji wejścia,
* pełnej walidacji cyklu.

Tylko 14 z 91 wierszy scenariuszy odwołuje się bezpośrednio do nazwanej bazy `FIX-*`.

**Konsekwencje:** Nie można automatycznie utworzyć pełnego zestawu testów bez zgadywania brakującego kontekstu i znaczenia oczekiwanego statusu.

**Wymagane działanie:** Dodać do każdego testu pole `testLevel` albo `component`, osobne statusy/asercje komponentowe oraz pełny fixture lub pełny zestaw zmian. `VALID` pozostawić wyłącznie dla pełnego `ValidationReport`.

## `V2-P-007` – Pochodne `requiredStaffCount` jest traktowane jak błąd użytkownika

**Ważność:** ŚREDNI  
**Pliki i sekcje:** `DANE_WEJSCIOWE.md` IV.3 i VIII.11; `ALGORYTM.md` I.2 i II.3; `MODEL_DANYCH.md` `RequiredCareInterval`; `TESTY_I_SCENARIUSZE.md` T-036; porównawczo `WALIDACJA.md` `REQ-VALIDATOR-INDEP-001`.

**Opis:** `requiredStaffCount` jest oznaczone jako `DERIVED` i jest ustawiane przez kalkulator na 1. Jednocześnie wartość 2 ma powodować `INVALID_INPUT` i `DANE_NIEPOPRAWNE`.

**Konsekwencje:** Nie wiadomo, czy wartość pochodzi od użytkownika, czy od modułu kalkulatora. W drugim przypadku `INVALID_INPUT` błędnie obarcza dane wejściowe; zgodnie z zasadą niezależnego walidatora powinien to być `INTERNAL_ERROR` i `BLAD_WEWNETRZNY`.

**Wymagane działanie:** Usunąć pole z surowego wejścia albo jawnie rozdzielić walidację wejścia od walidacji wyniku kalkulatora. Dodać dwa osobne testy, jeżeli oba przypadki są możliwe.

## `V2-P-008` – Brak semantyki nakładających się godzin funkcjonowania

**Ważność:** ŚREDNI  
**Pliki i sekcje:** `DANE_WEJSCIOWE.md` IV.1–IV.3; `ALGORYTM.md` II.3; `MODEL_DANYCH.md` `InternatOperatingInterval`; `WALIDACJA.md` II.

**Opis:** Plan może zawierać pełną listę wielu `InternatOperatingInterval`, ale dokumentacja nie mówi, czy nakładające się lub stykające przedziały:

* są błędem wejścia,
* są scalane do sumy zbiorów,
* są liczone osobno.

Dla przedziałów bez opieki częściowo opisano błąd lub jawne scalanie, lecz analogicznej reguły dla godzin funkcjonowania brak.

**Konsekwencje:** Kalkulator może podwójnie policzyć minuty albo uzyskać inny popyt niż niezależny walidator.

**Wymagane działanie:** Zdefiniować normalizację obu list jako operacje na zbiorach albo odrzucać nakładanie. Dodać testy nakładania, stykania i przedziałów rozłącznych.

## `V2-P-009` – Niepełne wzory preferencji

**Ważność:** ŚREDNI  
**Pliki i sekcje:** `ZASADY.md` II; `WALIDACJA.md` V; `DANE_WEJSCIOWE.md` VI; `ALGORYTM.md` VII; `MODEL_DANYCH.md` `OrganizationalRulesConfiguration`; `TESTY_I_SCENARIUSZE.md` X.

**Opis:** Dla części preferencji podano jednostkę kary, ale nie ma jednego pełnego wzoru wyniku. Szczególnie niejednoznaczne są:

* kara weekendu: suma odchyleń od 480 minut czy różnica długości części,
* agregacja kary z soboty i niedzieli,
* kara przekazania popołudnia przy kilku przedziałach lub kilku przekazaniach,
* sposób łączenia wszystkich wag w `objectiveScore`,
* zachowanie, gdy godzina 17:00 nie należy do popytu.

**Konsekwencje:** Dwa poprawne solvery mogą wybrać różne optimum i nadać różny `objectiveScore`.

**Wymagane działanie:** Zapisać jeden wzór matematyczny każdej kary i całej funkcji celu oraz uzupełnić testy o konkretne wartości punktowe i remisy.

## `V2-P-010` – Niepełne ograniczenia zgodności wersji i grup

**Ważność:** ŚREDNI  
**Pliki i sekcje:** `DANE_WEJSCIOWE.md` I–III; `MODEL_DANYCH.md` I.3, `EducatorWeekAssignmentOverride`, `DayCarePlan`, konfiguracje reguł, `WeekendRotationVariant`, `WorkAssignment`, X.

**Opis:** Model wymaga istnienia rodzica, ale nie wymaga jawnie, aby wszystkie równoległe referencje rekordu należały do tej samej wersji i grupy. Nie określa też dokładnie jednej konfiguracji prawnej i jednej organizacyjnej dla wersji.

Przykładowo override może wskazać wychowawcę z innej wersji logicznej, a `WorkAssignment` może wskazać grupę inną niż grupa wychowawcy.

**Konsekwencje:** Dane mogą być formalnie referencyjne, ale semantycznie mieszać konfiguracje. Generator i walidator mogą otrzymać różne zbiory reguł.

**Wymagane działanie:** Dodać złożone reguły integralności dla wersji i grupy, unikalność konfiguracji prawnej/organizacyjnej oraz testy referencji między wersjami.

## `V2-P-011` – Nieokreślony tryb demonstracyjny dla `EXPIRED`

**Ważność:** ŚREDNI  
**Pliki i sekcje:** `SPECYFIKACJA.md` 7; `ZASADY.md` `REQ-LEGAL-001`; `WALIDACJA.md` I.2 i `REQ-LEGAL-001`; `DANE_WEJSCIOWE.md` VII; `ALGORYTM.md` I.2 i `REQ-LEGAL-001`; `TESTY_I_SCENARIUSZE.md` T-111–T-114.

**Opis:** Dokumentacja zgodnie blokuje produkcję dla `EXPIRED`, ale nie mówi, czy profil wygasły:

* może zostać użyty w jawnym trybie demonstracyjnym,
* ma być traktowany jak `UNVERIFIED`,
* blokuje każde generowanie.

Pseudokod deleguje decyzję do nieopisanej funkcji `okreslTrybPrawny`.

**Konsekwencje:** Ta sama prośba demonstracyjna może otrzymać `DANE_NIEPOPRAWNE` albo `POPRAWNY_TRYB_DEMONSTRACYJNY`.

**Wymagane działanie:** Dodać pełną tabelę `verificationStatus × requestedOperationMode → wynik` i test demonstracyjny dla `EXPIRED`.

---

# V. Weryfikacja reguł

| Obszar | Ocena | Uzasadnienie |
|---|---|---|
| Dynamiczne obliczanie zapotrzebowania | `ZGODNA_Z_RYZYKIEM` | Popyt jest dynamiczny i niezależnie przeliczany. Pozostają duplikaty planu i nakładanie godzin (`V2-P-001`, `V2-P-008`). |
| Kompletne wyjątki dla dat | `ZGODNA_Z_RYZYKIEM` | `SPECIFIC_DATE` zastępuje cały plan. Brakuje unikalności planu tego samego poziomu. |
| Przydziały podstawowe i zastępcze | `ZGODNA` | Źródła i pierwszeństwo są jednoznaczne; bilans jest przed solverem. |
| Dokładnie pięć dni pracy | `ZGODNA` | Jedno globalne źródło, jasna definicja dnia i testy 4/5/6 dni. |
| Krok 30 minut | `ZGODNA` | Stała V1 i test nieprawidłowej granicy 14:45. |
| Minimum 2 godziny | `ZGODNA` | Każdy maksymalny odcinek ma minimum 120 minut i jest testowany osobno. |
| Zakaz odcinków przez północ | `ZGODNA` | Reguła jest jawna w danych, solverze, walidatorze i testach. |
| Krytyczne weekendy | `CZESCIOWA` | Krytyczność i rotacja są zgodne, ale mapowanie ról na dowolny popyt wymaga doprecyzowania (`V2-P-004`). |
| Cykl tydzień 6 → tydzień 1 | `CZESCIOWA` | Kontrola kołowa istnieje, lecz brakuje kotwicy tygodnia, strefy czasu i pełnej reguły odpoczynku (`V2-P-002`, `V2-P-003`, `V2-P-005`). |
| `HARD` i `PREFERRED` | `ZGODNA` | Klasy, dominacja, scalanie i znaczenie braku wpisu są jednoznaczne. |
| Dokładnie jedna osoba w slocie | `ZGODNA_Z_RYZYKIEM` | Jedna osoba jest jedyną regułą obsady; pozostaje klasyfikacja błędu pola pochodnego (`V2-P-007`). |
| Niezależność walidatora | `ZGODNA` | Walidator korzysta z surowych planów, przelicza popyt i nie ufa podsumowaniom. |
| Tryb produkcyjny i demonstracyjny | `CZESCIOWA` | `VERIFIED` i `UNVERIFIED` są jasne; demo dla `EXPIRED` nie jest określone (`V2-P-011`). |
| Statusy systemowe | `ZGODNA_Z_RYZYKIEM` | Zbiory statusów są rozdzielone; problem dotyczy granicy `INVALID_INPUT`/`INTERNAL_ERROR` dla danych pochodnych. |
| Stabilne `ruleId` | `ZGODNA` | Wszystkie dokumenty zawierają ten sam rejestr 18 reguł krytycznych i 5 preferowanych. |
| Kompletność testów | `CZESCIOWA` | Macierz dodatnia/ujemna istnieje, ale wiele testów nie określa pełnego fixture ani poziomu testu (`V2-P-006`). |

Wartości `06:00–08:00`, `14:30–22:00`, `06:00–22:00`, `08:00–14:30` i `79,5 godziny` są konsekwentnie oznaczone jako demonstracyjne lub testowe. Nie są przedstawione jako stałe systemowe.

---

# VI. Weryfikacja prawna

## 1. Problemy dokumentacyjne związane z profilem prawnym

Do problemów dokumentacyjnych, a nie do samego braku opinii prawnej, należą:

* brak strukturalnej definicji okna odpoczynku tygodniowego i wyjątków (`V2-P-005`),
* brak strefy czasowej i reguły zmiany czasu (`V2-P-003`),
* brak pełnej tabeli zachowania `EXPIRED` w trybie demonstracyjnym (`V2-P-011`).

Problemy te wymagają rozstrzygnięcia w dokumentacji nawet wtedy, gdy aplikacja działa wyłącznie demonstracyjnie.

## 2. Nierozstrzygnięte kwestie wymagające zewnętrznej weryfikacji prawnej

Nie są one liczone jako sprzeczności dokumentacji:

* minimalny odpoczynek dobowy,
* minimalny odpoczynek tygodniowy,
* prawnie dopuszczalne wyjątki od odpoczynków,
* maksymalna długość pracy w dobie,
* maksymalna długość pojedynczego odcinka,
* prawne zasady wolnych weekendów,
* zasady rozliczania godzin ponadwymiarowych,
* właściwy okres i tydzień odniesienia,
* jurysdykcja, źródło, data obowiązywania i osoba zatwierdzająca,
* sposób uwzględniania urzędowej zmiany czasu w obliczeniach prawnych.

Dokumentacja prawidłowo:

* oznacza 11 i 35 godzin jako wartości robocze,
* wymaga `VERIFIED` do użycia produkcyjnego,
* przy `UNVERIFIED` dopuszcza wyłącznie jawny tryb demonstracyjny,
* blokuje produkcję dla `EXPIRED`,
* wymaga śladu prawnego i zakresu obowiązywania.

Brak zewnętrznej weryfikacji prawnej sam w sobie nie jest zatem nową sprzecznością dokumentacji.

---

# VII. Kryteria gotowości

| Kryterium | Wynik |
|---|---|
| Liczba problemów krytycznych wynosi 0 | `SPELNIONE` |
| Liczba wysokich problemów blokujących wynosi 0 | `NIESPELNIONE` – 6 |
| Wszystkie decyzje zostały wdrożone operacyjnie | `NIESPELNIONE` – 7 decyzji wymaga doprecyzowania operacyjnego |
| Wszystkie reguły krytyczne mają `ruleId` | `SPELNIONE` |
| Każda reguła krytyczna ma test poprawny i niepoprawny | `SPELNIONE_FORMALNIE` |
| Testy są bezpośrednio wykonywalne bez uzupełniania kontekstu | `NIESPELNIONE` |
| Model zawiera wszystkie informacje generatora i walidatora | `NIESPELNIONE` – brak kotwicy tygodnia, strefy czasu i części reguł integralności |
| Walidator jest niezależny od generatora | `SPELNIONE` |
| Wszystkie wartości przykładowe są oznaczone | `SPELNIONE` |
| Kwestie prawne są odseparowane od trybu demo | `SPELNIONE_CZESCIOWO` – brak ścieżki demo dla `EXPIRED` i struktury okna odpoczynku |

Dokumentacja nie może otrzymać statusu:

`GOTOWA DO PROJEKTOWANIA IMPLEMENTACJI`

przed usunięciem co najmniej problemów `V2-P-001`–`V2-P-006`.

---

# VIII. Odpowiedzi końcowe

## 1. Czy dokumentacja jest gotowa do projektowania implementacji?

**Nie.** Istnieje 6 problemów wysokich blokujących jednoznaczny projekt modelu czasu, weekendów, odpoczynków oraz testów.

## 2. Czy można rozpocząć wybór technologii?

**Można rozpocząć wyłącznie wstępne, niewiążące porównanie technologii.** Nie należy jeszcze zatwierdzać architektury danych, reprezentacji czasu ani interfejsu solvera.

## 3. Czy można zaprojektować solver bez zgadywania?

**Nie.** Solver musiałby zgadywać co najmniej sposób wyboru duplikatów planu, kotwicę tygodnia, semantykę czasu przy zmianie strefowej, role weekendowe przy popycie rozłącznym oraz okno odpoczynku tygodniowego.

## 4. Czy można utworzyć wykonywalne testy?

**Częściowo.** Można utworzyć część testów jednostkowych oraz konkretny fixture `FIX-CYCLE-VALID`, ale nie można bez zgadywania zbudować całego zestawu testów akceptacyjnych, ponieważ wiele scenariuszy cząstkowych używa globalnych statusów bez pełnego kontekstu.

## 5. Czy użycie produkcyjne jest zablokowane bez zweryfikowanej konfiguracji prawnej?

**Tak.** Produkcja wymaga `VERIFIED`; `UNVERIFIED` pozwala wyłącznie na jawne demo, a `EXPIRED` blokuje produkcję.

## 6. Jakie kwestie pozostają przed rozpoczęciem kodowania?

Przed rozpoczęciem kodowania należy:

1. ustanowić unikalność i wybór kompletnego planu dnia,
2. zdefiniować początek tygodnia,
3. dodać strefę czasową i regułę zmiany czasu,
4. sformalizować weekendowe role dla dowolnego dynamicznego popytu,
5. zdefiniować okno i wyjątki odpoczynku tygodniowego,
6. rozdzielić testy jednostkowe, komponentowe i pełne testy cyklu,
7. rozstrzygnąć status błędu pochodnego `requiredStaffCount`,
8. określić normalizację godzin funkcjonowania,
9. zapisać pełne wzory preferencji i funkcji celu,
10. dodać integralność wersji i grup oraz unikalność konfiguracji reguł,
11. zdefiniować zachowanie `EXPIRED` w trybie demonstracyjnym.

Zewnętrzna weryfikacja prawna może pozostać osobnym procesem, jeżeli przed jej zakończeniem system zachowuje wyłącznie jawny tryb demonstracyjny i nie przedstawia wyników jako produkcyjnie zgodnych z prawem.

---

# IX. Ograniczenia wykonania audytu

W ramach tego audytu:

* nie zmodyfikowano dokumentów źródłowych,
* nie zmodyfikowano pierwotnego `RAPORT_SPOJNOSCI.md`,
* nie poprawiono automatycznie wykrytych problemów,
* nie utworzono kodu aplikacji,
* nie zainstalowano bibliotek,
* nie rozpoczęto implementacji ani wyboru konkretnego solvera.
