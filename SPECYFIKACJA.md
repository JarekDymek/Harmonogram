# Harmonogram pracy wychowawców internatu Młodzieżowego Ośrodka Wychowawczego

## 1. Cel projektu

Celem projektu jest stworzenie aplikacji webowej wspomagającej generowanie harmonogramów pracy wychowawców internatu Młodzieżowego Ośrodka Wychowawczego.

Aplikacja:

* korzysta wyłącznie z kompletnych, zatwierdzonych danych wejściowych,
* nie zgaduje brakujących danych,
* nie łagodzi reguł krytycznych,
* oddziela generator od niezależnego walidatora,
* podaje jednoznaczny status i raport wyniku.

`DECYZJE_PROJEKTOWE.md` jest autorytatywnym źródłem rozstrzygnięć projektowych. Wartości wynikające z prawa wymagają osobnego zatwierdzenia w konfiguracji prawnej.

## 2. Zakres pierwszej wersji

Pierwsza wersja:

* obsługuje jedną grupę wychowawczą,
* obsługuje dokładnie trzech wychowawców,
* nie dodaje wychowawcy rezerwowego ani puli międzygrupowej,
* generuje pełny cykl sześciu kolejnych tygodni,
* traktuje cykl jako powtarzalny,
* wymaga początku cyklu w poniedziałek i `weekStartDay = MONDAY`,
* zapisuje jawną strefę IANA `Europe/Warsaw`,
* sprawdza wszystkie przejścia między tygodniami, w tym tydzień 6 → tydzień 1,
* umożliwia prezentowanie pojedynczych tygodni wyłącznie w kontekście całego cyklu,
* oblicza zapotrzebowanie osobno dla każdej daty,
* uwzględnia kompletne plany konkretnych tygodni i dat,
* uwzględnia przydziały zastępcze zatwierdzone dla konkretnego tygodnia,
* stosuje zatwierdzone, dokładne weekendowe wzorce godzinowe,
* przekazuje każdego kandydata do niezależnego walidatora.

## 3. Elementy poza zakresem pierwszej wersji

Pierwsza wersja nie obsługuje:

* ręcznej edycji wygenerowanego harmonogramu,
* blokowania ręcznie wpisanych zmian,
* importu ani eksportu JSON,
* trwałej bazy danych,
* wielu grup,
* porównywania z poprzednim harmonogramem,
* minimalizacji zmian względem poprzedniej wersji.

Możliwość późniejszej rozbudowy nie wpływa na kryteria akceptacji pierwszej wersji.

## 4. Dynamiczne zapotrzebowanie

Godziny wymaganej opieki nie są stałą systemową.

Dla każdej daty aplikacja:

1. wymaga dokładnie jednego skutecznego, kompletnego i zatwierdzonego planu wybranego przez hierarchię,
2. normalizuje jawne godziny funkcjonowania przez sumę zbiorów,
3. normalizuje wszystkie przedziały, w których opieka internatu nie jest wymagana,
4. oblicza `union(operatingIntervals) \ union(noCareIntervals)`,
5. otrzymuje rozłączne przedziały wymaganej opieki,
6. rozbija wynik na sloty 30-minutowe.

Dwa zatwierdzone plany o tym samym kluczu albo brak skutecznego planu powodują `INVALID_INPUT`.

Godziny `06:00–08:00`, `14:30–22:00`, `08:00–14:30` oraz wartość `79,5 godziny` mogą być jawną konfiguracją albo danymi demonstracyjnymi; nie są ukrytymi stałymi.

Zatwierdzony przez placówkę bazowy przedział weekendowej opieki `[06:00,22:00)` w sobotę i niedzielę jest rzeczywistą regułą biznesową aktualnego wzorca. Jest przechowywany jawnie i może zostać zastąpiony dla dnia specjalnego wyłącznie przez kompletny plan daty oraz zatwierdzony wariant weekendowy `SUBSTITUTE`.

## 5. Dokładne wzorce weekendowe

Weekend obsługują dokładnie dwaj z trzech wychowawców; trzeci ma wolną sobotę i niedzielę. Nie występuje podwójna obsada.

Każdy wariant rotacji przechowuje osobny, zatwierdzony szablon soboty i niedzieli. Rzeczywisty harmonogram musi bez tolerancji odpowiadać krotkom:

`(dayOfWeek, sequenceNumber, educatorId, startTime, endTime)`.

Generator nie może:

* zmieniać godzin ani kolejności,
* zamieniać osób lub odcinków,
* optymalizować wzorca,
* tworzyć wariantu zastępczego.

Role `RANO`, `PO_POLUDNIU` i `WOLNE` mogą istnieć jedynie jako etykiety `DERIVED`. Nie są źródłem walidacji.

Jeżeli `SPECIFIC_DATE` zmienia weekendowe zapotrzebowanie i wzorzec bazowy przestaje pasować, przed solverem wymagany jest dokładnie jeden pełny, zatwierdzony wariant `SUBSTITUTE`. Jego brak powoduje `INVALID_INPUT`.

## 6. Czas, tydzień i integralność

`cycleStartDate` przypada w poniedziałek, a tydzień `n` zaczyna się `cycleStartDate + 7 × (n - 1) dni`.

`ScheduleConfigurationVersion.timeZoneId` jest jawne. W V1 widocznie wstępnie wybrana wartość to `Europe/Warsaw`. Brak strefy oraz nieistniejąca lub niejednoznaczna lokalna granica czasu powodują `INVALID_INPUT`.

Odpoczynek jest rzeczywistą liczbą minut na osi czasu. Wszystkie dane jednego przebiegu należą do tej samej wersji i grupy. Wersja posiada dokładnie jedną konfigurację organizacyjną i jeden wybrany profil prawny.

## 7. Słownik pojęć

* **wychowawca** – osoba uwzględniana przez generator; określenie „pracownik” nie jest używane jako osobny typ uczestnika;
* **przedział czasu** – półotwarty zakres `[początek, koniec)` zapisany w danych albo wyliczony z danych;
* **slot** – niepodzielna, 30-minutowa jednostka obliczeń;
* **odcinek pracy** – maksymalny ciąg sąsiadujących slotów przypisanych jednemu wychowawcy w jednej dacie;
* **dzień pracy** – data, w której wychowawca ma co najmniej jeden odcinek;
  dyżur nocny przechodzący przez północ jest wyjątkiem i do liczby dni pracy
  należy wyłącznie do daty rozpoczęcia, choć jego cały przedział pozostaje
  zajęty na potrzeby kolizji i odpoczynku;
* **plan dnia** – kompletny opis godzin funkcjonowania i wszystkich przedziałów bez wymaganej opieki dla grupy;
* **zapotrzebowanie** – przedziały wymaganej opieki obliczone z planu dnia;
* **przydział godzin** – wymagana liczba minut danego wychowawcy w konkretnym tygodniu, a nie odcinek pracy;
* **harmonogram** – pełny sześciotygodniowy cykl przydziałów pracy;
* **weekendowy wzorzec** – zatwierdzona, dokładna lista krotek pracy soboty i niedzieli dla pozycji rotacji;
* **wariant zastępczy** – pełny, zatwierdzony wzorzec `SUBSTITUTE` dla konkretnego weekendu, którego generator nie tworzy;
* **etykieta roli** – informacja prezentacyjna `DERIVED`, nie źródło ograniczenia.

## 8. Artefakt wynikowy i statusy

Solver wyszukuje kandydatów dla całego cyklu. Status `CANDIDATE_FOUND` nie oznacza jeszcze poprawnego harmonogramu.

Harmonogram może otrzymać publiczny wynik:

* `POPRAWNY` – konfiguracja prawna ma status `VERIFIED`, wybrano `PRODUCTION`, a walidator zwrócił `VALID`,
* `POPRAWNY_TRYB_DEMONSTRACYJNY` – jawnie wybrano `DEMONSTRATION`, a wynik jest wyraźnie oznaczony jako niezatwierdzony do rzeczywistego użycia,
* `DANE_NIEPOPRAWNE` – walidacja wejścia zwróciła `INVALID_INPUT`,
* `BRAK_ROZWIAZANIA` – solver udowodnił brak rozwiązania,
* `NIE_ZAKONCZONO_WYSZUKIWANIA` – solver osiągnął limit czasu,
* `BLAD_WEWNETRZNY` – wystąpiła rozbieżność modułów albo błąd systemu.

Kandydat spełniający wszystkie wymagane warunki jest publikowany jako propozycja planu po niezależnej walidacji. Nie trzeba udowadniać optymalności podziału preferencji. Limit czasu oznacza brak ukończonego wyszukiwania tylko wtedy, gdy nie znaleziono żadnego poprawnego kandydata; ulepszanie jakości jest osobną, opcjonalną operacją.

## 9. Konfiguracja prawna

Generowanie do rzeczywistego użycia wymaga konfiguracji prawnej o statusie `VERIFIED` i trybu `PRODUCTION`.

Statusy konfiguracji prawnej:

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

Każdy wynik demonstracyjny pokazuje brak dopuszczenia do rzeczywistego użycia, status i wersję profilu oraz datę weryfikacji albo wygaśnięcia.

Profil prawny definiuje pełną strukturę okna odpoczynku tygodniowego, sposób przypisania odpoczynku, ponowne użycie między oknami, wyjątki i kompensację. Aplikacja nie ustala tych metod ani wartości samodzielnie. Wartości 11 i 35 godzin pozostają robocze do czasu zewnętrznej weryfikacji.

## 10. Architektura logiczna

System składa się z odrębnych warstw:

1. modelu danych,
2. walidacji danych wejściowych,
3. kalkulatora zapotrzebowania,
4. generatora harmonogramu,
5. niezależnego walidatora,
6. funkcji oceny mierzalnych preferencji,
7. raportowania,
8. interfejsu użytkownika.

Walidator ponownie oblicza zapotrzebowanie z surowych planów dnia i nie ufa podsumowaniom generatora.

Pole `requiredStaffCount` jest wyłącznie `DERIVED` i w V1 wynosi `1`. Nie należy do danych użytkownika. Inna wartość w wyniku kalkulatora powoduje `INTERNAL_ERROR`, `BLAD_WEWNETRZNY` i `REQ-VALIDATOR-INDEP-001`, z kontekstem `REQ-STAFFING-001`.

## 11. Funkcja celu

Po spełnieniu reguł krytycznych stosuje się:

* `P_afternoon = Σ |handoverMinute - preferredAfternoonHandoverMinute| / timeStepMinutes`,
* `P_weekend = Σ |assignedMinutes - preferredWeekendSplitMinutes| / timeStepMinutes`,
* `P_splitDays = Σ max(0, segmentCount(educator, date) - 1)`,
* `P_longSegments = Σ max(0, durationMinutes - preferredMaximumSegmentMinutes) / timeStepMinutes`,
* `P_preferredUnavailable` – liczbę przypisanych slotów przecinających znormalizowane `PREFERRED`.

Łączny wynik:

`objectiveScore = wA × P_afternoon + wW × P_weekend + wS × P_splitDays + wL × P_longSegments + wU × P_preferredUnavailable`.

`P_afternoon` dotyczy przekazań w roboczym ciągłym przedziale zawierającym godzinę preferowaną; brak takiego popytu albo brak podziału daje `0`. `P_weekend` jest sumowane osobno dla obu osób i obu dni. `P_preferredUnavailable` jest liczone po normalizacji i dominacji `HARD`.

Wagi są jawnymi, nieujemnymi liczbami całkowitymi. `P_weekend` nie pozwala zmieniać zatwierdzonego wzorca; służy tylko do raportowania albo porównania kilku zatwierdzonych wariantów `SUBSTITUTE`.

Remis rozstrzyga mniejszy wektor `(P_afternoon, P_weekend, P_splitDays, P_longSegments, P_preferredUnavailable)`, a następnie leksykograficznie mniejsza kanoniczna lista `(date, startTime, endTime, educatorId)`.

## 12. Rejestr stabilnych identyfikatorów reguł

### Reguły krytyczne

* `REQ-NO-GUESSING-001` – zakaz zgadywania i łagodzenia ograniczeń,
* `REQ-SPECIAL-DAY-001` – kompletny plan daty i hierarchia źródeł,
* `REQ-TIME-STEP-001` – krok 30 minut,
* `REQ-TIME-SAME-DAY-001` – zakaz odcinków przez północ,
* `REQ-SEGMENT-MIN-001` – minimum 2 godziny,
* `REQ-COVERAGE-001` – ciągłość wymaganej opieki,
* `REQ-STAFFING-001` – dokładnie jedna osoba w wymaganym slocie,
* `REQ-NO-OUTSIDE-001` – zakaz pracy poza zapotrzebowaniem,
* `REQ-HOURS-001` – dokładny przydział godzin w każdym tygodniu,
* `REQ-DAYS-001` – dokładnie pięć dni pracy,
* `REQ-UNAVAILABLE-HARD-001` – bezwzględna niedostępność,
* `REQ-REST-DAILY-001` – odpoczynek dobowy,
* `REQ-REST-WEEKLY-001` – odpoczynek tygodniowy,
* `REQ-WEEKEND-001` – dokładna zgodność z zatwierdzonym wzorcem weekendowym,
* `REQ-ROTATION-001` – sześciotygodniowa rotacja dokładnych wariantów,
* `REQ-CROSS-WEEK-001` – spójność kołowego cyklu,
* `REQ-VALIDATOR-INDEP-001` – niezależne obliczenia walidatora,
* `REQ-LEGAL-001` – zatwierdzona konfiguracja prawna.

### Reguły preferowane

* `REQ-PREF-AFTERNOON-001` – przekazanie popołudnia blisko 17:00,
* `REQ-PREF-WEEKEND-SPLIT-001` – podział weekendu blisko 8 + 8,
* `REQ-PREF-SPLIT-DAYS-001` – minimalizacja dni dzielonych,
* `REQ-PREF-LONG-SEGMENT-001` – minimalizacja odcinków ponad 8 godzin,
* `REQ-PREF-UNAVAILABLE-001` – unikanie niedostępności `PREFERRED`.

## 13. Poziomy testów

Obowiązują: `INPUT_VALIDATION`, `CALCULATOR_UNIT`, `RULE_VALIDATOR_UNIT`, `SOLVER_INTEGRATION` i `END_TO_END`.

Każdy test posiada poziom, kompletny fixture, pełną zmianę, oczekiwany status, `ruleId` oraz wartości wymagane i faktyczne. Statusy `VALID` i `INVALID` dotyczą wyłącznie pełnego `ValidationReport`.

## 14. Kryterium gotowości

Etap dokumentacyjny jest gotowy do implementacji dopiero po:

* zastosowaniu wszystkich decyzji `DP-001`–`DP-051`,
* ujednoliceniu dokumentów i testów,
* osobnym zatwierdzeniu konfiguracji prawnej albo jawnym wyborze trybu demonstracyjnego,
* potwierdzeniu, że każda reguła krytyczna posiada test poprawny i niepoprawny.
