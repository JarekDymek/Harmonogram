# Changelog dokumentacji

## 2026-07-23 — integracja doprecyzowań V2

### Zakres zmiany

Zintegrowano rozwiązania `DV2-001`–`DV2-011` z `DOPRECYZOWANIA_V2.md` w aktywnych dokumentach projektu. Dodano wiążące decyzje `DP-041`–`DP-051` i usunięto miejsca wymagające zgadywania przy projektowaniu modelu danych, generatora, niezależnego walidatora oraz testów.

Zmieniono:

* `DECYZJE_PROJEKTOWE.md` — dodano `DP-041`–`DP-051` i ujednolicono wcześniejsze decyzje dotyczące weekendów, pól `DERIVED`, funkcji celu i trybu prawnego;
* `SPECYFIKACJA.md` — dodano unikalność planów, kotwicę poniedziałkową, strefę czasu, dokładne wzorce weekendowe, pełną strukturę odpoczynku tygodniowego, funkcję celu i macierz trybu prawnego;
* `ZASADY.md` — zapisano normalizację przedziałów jako działania na zbiorach, dokładne krotki weekendowe, liczenie odpoczynku na osi czasu i jednoznaczne wzory preferencji;
* `WALIDACJA.md` — rozszerzono niezależne przeliczanie danych, kontrolę krotek, integralności złożonej, pól `DERIVED`, czasu rzeczywistego i statusów poziomów testowych;
* `DANE_WEJSCIOWE.md` — dodano wymagane pola konfiguracji czasu, pełny profil odpoczynku tygodniowego, zatwierdzone szablony `BASE` i `SUBSTITUTE`, wagi celu i reguły integralności;
* `ALGORYTM.md` — zastąpiono decyzje o abstrakcyjnych rolach weekendowych wstawianiem zatwierdzonych krotek, dodano normalizację, bramki integralności, pełną funkcję celu i macierz trybu prawnego;
* `MODEL_DANYCH.md` — dodano encje szablonów weekendowych i powiązania odpoczynku, pola źródłowe i pochodne, ograniczenia unikalności oraz spójność wersji, grupy i wychowawców;
* `TESTY_I_SCENARIUSZE.md` — wprowadzono pięć poziomów testów, kompletne fixtures, scenariusze `WV2-T-*`, testy DST, normalizacji, integralności, funkcji celu, pól `DERIVED` i pełnej macierzy prawnej;
* `CHANGELOG_DOKUMENTACJI.md` — dodano niniejszy wpis.

Nie zmodyfikowano historycznych `RAPORT_SPOJNOSCI.md` ani `RAPORT_SPOJNOSCI_V2.md`. Nie utworzono kodu, nie wybrano technologii ani solwera i nie instalowano bibliotek.

Model pozostał trzyosobowy: w weekend pracują dokładnie dwie osoby, a trzecia ma wolne; nie dodano rezerwy ani puli międzygrupowej. Dokładne, zatwierdzone wzorce weekendowe są zachowane 1:1 i nie mogą być zmieniane ani optymalizowane przez generator.

### Zastosowane decyzje

* `DP-041` — jeden zatwierdzony plan na klucz i dokładnie jeden skuteczny plan dla każdej daty;
* `DP-042` — `cycleStartDate` przypada w poniedziałek, a `weekStartDay = MONDAY`;
* `DP-043` — obowiązkowa strefa IANA `Europe/Warsaw` i obliczenia odpoczynków na osi czasu;
* `DP-044` — weekend jest walidowany przez dokładne, zatwierdzone krotki osób i czasu;
* `DP-045` — profil prawny przechowuje pełną strukturę odpoczynku tygodniowego;
* `DP-046` — pięć poziomów testów ma rozłączne kontrakty statusów i kompletne fixtures;
* `DP-047` — rozbieżność pola `DERIVED` jest błędem wewnętrznym, a nie błędem wejścia;
* `DP-048` — popyt i niedostępności są normalizowane jako sumy zbiorów bez podwójnego liczenia;
* `DP-049` — obowiązują pełne wzory pięciu kar, sumy ważonej i deterministycznego rozstrzygania remisów;
* `DP-050` — obowiązują złożone reguły integralności wersji, grupy, konfiguracji i wychowawców;
* `DP-051` — `EXPIRED` blokuje produkcję, ale wraz z `UNVERIFIED` dopuszcza jawnie oznaczony tryb demonstracyjny.

### Status problemów V2

| Problem | Status po integracji | Rozwiązanie |
|---|---|---|
| `V2-P-001` | `ROZWIAZANY` | unikalność planów i dokładnie jeden skuteczny plan (`DP-041`) |
| `V2-P-002` | `ROZWIAZANY` | poniedziałkowa kotwica cyklu (`DP-042`) |
| `V2-P-003` | `ROZWIAZANY` | strefa IANA i czas rzeczywisty (`DP-043`) |
| `V2-P-004` | `ROZWIAZANY` | dokładne krotki weekendowe (`DP-044`) |
| `V2-P-005` | `ROZWIAZANY` | kompletna struktura odpoczynku tygodniowego (`DP-045`) |
| `V2-P-006` | `ROZWIAZANY` | poziomy testów, statusy i kompletne fixtures (`DP-046`) |
| `V2-P-007` | `ROZWIAZANY` | rozbieżność `DERIVED` jako `INTERNAL_ERROR` (`DP-047`) |
| `V2-P-008` | `ROZWIAZANY` | normalizacja przez sumę zbiorów (`DP-048`) |
| `V2-P-009` | `ROZWIAZANY` | pełna i deterministyczna funkcja celu (`DP-049`) |
| `V2-P-010` | `ROZWIAZANY` | reguły integralności złożonej (`DP-050`) |
| `V2-P-011` | `ROZWIAZANY` | pełna macierz status profilu × tryb (`DP-051`) |

### Kwestie prawne pozostające do zewnętrznej weryfikacji

Integracja rozwiązuje niespójności dokumentacyjne, ale nie zastępuje prawnej weryfikacji placówki. Przed użyciem produkcyjnym nadal trzeba zatwierdzić i udokumentować:

* wartości minimalnych odpoczynków, maksymalnych limitów i innych norm czasu pracy;
* definicję okna odpoczynku tygodniowego, sposób przypisania odpoczynku do okna, wyjątki i kompensacje;
* podstawę prawną, jurysdykcję, źródło, zakres dat, osobę zatwierdzającą i datę zatwierdzenia;
* dokładne produkcyjne wzorce weekendowe placówki oraz ich zgodność z zatwierdzonym profilem prawnym;
* okresowy przegląd ważności profilu.

Tryb `PRODUCTION` jest dozwolony wyłącznie dla właściwego, kompletnego i obowiązującego profilu `VERIFIED`. Profile `UNVERIFIED` i `EXPIRED` dopuszczają tylko jawnie oznaczony tryb `DEMONSTRATION` z ostrzeżeniem.

---

## 2026-07-23 — ujednolicenie dokumentacji po decyzjach projektowych

### Zakres zmiany

Zaktualizowano dokumentację projektu zgodnie z decyzjami `DP-001`–`DP-040` zapisanymi w `DECYZJE_PROJEKTOWE.md`.

Zmieniono:

* `SPECYFIKACJA.md` — uporządkowano zakres wersji pierwszej, sześciotygodniowy cykl, dynamiczne zapotrzebowanie, statusy wyniku, tryby zgodności prawnej oraz rejestr reguł;
* `ZASADY.md` — zapisano reguły krytyczne i preferencje z trwałymi identyfikatorami oraz jednoznacznie określono ich charakter;
* `WALIDACJA.md` — zdefiniowano niezależną walidację surowych danych i wyniku, ponowne wyliczanie zapotrzebowania oraz raportowanie konfliktów;
* `DANE_WEJSCIOWE.md` — ujednolicono zakresy planów opieki, wyjątki, nadpisania tygodniowego wymiaru, dane prawne i wymagane pola wejściowe;
* `ALGORYTM.md` — opisano budowę i walidację cyklu, ograniczenia krytyczne, mierzalne preferencje, statusy zakończenia i diagnostykę braku rozwiązania;
* `MODEL_DANYCH.md` — wskazano relacje nadrzędne, pola źródłowe i pochodne, zakresy encji, statusy oraz strukturę raportu konfliktów;
* `TESTY_I_SCENARIUSZE.md` — dodano scenariusze dodatnie i ujemne dla każdej reguły krytycznej, przypadki graniczne, testy niezależnego walidatora i mapę pokrycia reguł.

Ponadto ujednolicono wielkość liter w nazwie pliku do dokładnie `SPECYFIKACJA.md`, zgodnie z `DP-040`.

### Zastosowane decyzje

* `DP-001`–`DP-002` — zakres wersji pierwszej i sześciotygodniowego cyklu;
* `DP-003`–`DP-006` — dynamiczne zapotrzebowanie, jawna konfiguracja, kompletne wyjątki i hierarchia planów;
* `DP-007`–`DP-009` — krok czasu, minimalny odcinek i zakaz odcinków przez północ;
* `DP-010`–`DP-013` — liczba dni, przydziały podstawowe i zastępcze oraz bilans minut;
* `DP-014`–`DP-017` — krytyczne reguły weekendu, rotacja i preferowany podział;
* `DP-018`–`DP-020` — niedostępności `HARD` i `PREFERRED` oraz ich łączenie;
* `DP-021`–`DP-023` — pojedyncza obsada, cykliczność i niezależny walidator;
* `DP-024`–`DP-026` — tryby zgodności prawnej, metadane źródeł oraz blokada trybu produkcyjnego;
* `DP-027`–`DP-031` — statusy walidacji i generowania oraz limit czasu;
* `DP-032`–`DP-035` — trwałe identyfikatory reguł, raport konfliktów, relacje nadrzędne i pola pochodne;
* `DP-036`–`DP-040` — `groupId`, typy wydarzeń, mierzalne preferencje, zakres elementów przyszłościowych oraz wielkość liter w nazwie specyfikacji.

### Rozwiązane problemy raportu spójności

Na poziomie dokumentacji rozwiązano wszystkie problemy `P-001`–`P-032` opisane w `RAPORT_SPOJNOSCI.md`.

| Problem | Sposób rozwiązania |
|---|---|
| `P-001` | Zapotrzebowanie jest zawsze dynamiczne (`DP-003`–`DP-006`). |
| `P-002` | Krok pierwszej wersji wynosi dokładnie 30 minut (`DP-007`). |
| `P-003` | Wprowadzono statusy i tryby konfiguracji prawnej (`DP-024`–`DP-026`). |
| `P-004` | Przydziały podstawowe i zastępcze są bilansowane z rzeczywistym popytem (`DP-011`–`DP-013`). |
| `P-005` | Wyjątek daty jest kompletnym planem, a hierarchia jest jednoznaczna (`DP-005`–`DP-006`). |
| `P-006` | Jedynym źródłem liczby dni jest konfiguracja organizacyjna (`DP-010`). |
| `P-007` | Artefaktem jest kołowy cykl sześciu tygodni (`DP-001`, `DP-022`). |
| `P-008` | Walidator ponownie liczy popyt i podsumowania z surowych danych (`DP-023`). |
| `P-009` | Reguły krytyczne i preferencje zostały rozdzielone (`DP-014`, `DP-018`–`DP-019`, `DP-038`). |
| `P-010` | Historyczny model ról z `DP-014`–`DP-016` został następnie zastąpiony dokładnymi szablonami i krotkami przez `DP-044`; role są obecnie wyłącznie `DERIVED`. |
| `P-011` | Wszyscy trzej wychowawcy muszą być dopuszczeni do weekendów (`DP-017`). |
| `P-012` | Niezgodny bilans daje `INVALID_INPUT` i `DANE_NIEPOPRAWNE` przed solverem (`DP-013`, `DP-027`, `DP-030`). |
| `P-013` | Limit czasu daje `TIME_LIMIT` i nie publikuje kandydata (`DP-031`). |
| `P-014` | Minimum odcinka jest stałą pierwszej wersji równą 120 minut (`DP-008`). |
| `P-015` | Jedyną dozwoloną obsadą wymaganego slotu jest jedna osoba (`DP-021`). |
| `P-016` | Konfiguracja prawna przechowuje pełny ślad źródłowy (`DP-025`). |
| `P-017` | Relacja dziecko → rodzic jest autorytatywna (`DP-034`). |
| `P-018` | Wprowadzono globalny rejestr trwałych `ruleId` (`DP-032`). |
| `P-019` | Raport konfliktu ma jawny poziom jakości (`DP-033`). |
| `P-020` | Niedostępności są sumowane, scalane i rozstrzygane z przewagą `HARD` (`DP-020`). |
| `P-021` | Zakres pierwszej wersji i artefakt wynikowy są jednoznaczne (`DP-001`–`DP-002`). |
| `P-022` | Dodano wspólny słownik i ujednolicono pojęcia czasu, pracy oraz zapotrzebowania. |
| `P-023` | Zdarzenia używają `eventType`, `customEventType` i `description` (`DP-037`). |
| `P-024` | Zakresy kompletnych planów mają jawne wartości i pola warunkowe (`DP-005`–`DP-006`). |
| `P-025` | Wszystkie dane wpływające na popyt zawierają `groupId` (`DP-036`). |
| `P-026` | Odcinki przez północ są zabronione, a pracownicy nocni są poza zakresem (`DP-009`). |
| `P-027` | Pola ręcznej edycji, blokad i JSON usunięto z pierwszej wersji (`DP-002`). |
| `P-028` | Pola pochodne oznaczono jako `DERIVED` i podlegają niezależnemu przeliczeniu (`DP-035`). |
| `P-029` | Rozdzielono statusy wejścia, solvera, walidacji i wyniku publicznego (`DP-027`–`DP-030`). |
| `P-030` | Testy otrzymały jednoznaczne dane, wyniki i brakujące przypadki graniczne. |
| `P-031` | Pozostawiono wyłącznie mierzalne preferencje (`DP-038`–`DP-039`). |
| `P-032` | Nazwę i aktywne odwołania ujednolicono do `SPECYFIKACJA.md` (`DP-040`). |

`RAPORT_SPOJNOSCI.md` pozostaje niezmienionym dokumentem historycznym.

### Kwestie prawne pozostające do zewnętrznej weryfikacji

Dokumentacja określa mechanizm wersjonowania i zatwierdzania profilu prawnego, ale nie przesądza treści norm prawnych bez wskazania zweryfikowanych źródeł. Przed użyciem produkcyjnym wymagane są:

* weryfikacja obowiązujących norm czasu pracy i odpoczynku przez uprawnioną osobę;
* wskazanie źródła, jurysdykcji, daty obowiązywania i daty weryfikacji każdej normy;
* zatwierdzenie odpoczynku dobowego i tygodniowego oraz wyjątków od tych odpoczynków;
* zatwierdzenie maksymalnej długości pracy w dobie i maksymalnej długości pojedynczego odcinka;
* zatwierdzenie prawnych zasad wolnych weekendów i rozliczania godzin ponadwymiarowych;
* zatwierdzenie właściwej interpretacji tygodnia odniesienia;
* okresowy przegląd ważności profilu prawnego.

Do czasu zatwierdzenia i zachowania ważności profilu prawnego aplikacja może działać wyłącznie w trybie demonstracyjnym i nie może oznaczać harmonogramu jako produkcyjnie zgodnego z prawem.

### Implementacja

Nie utworzono ani nie zmodyfikowano kodu aplikacji, bibliotek, konfiguracji wykonawczej ani innych elementów implementacji. Zmiana obejmuje wyłącznie dokumentację Markdown.
