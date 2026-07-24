# Harmonogram MOW

Responsywna aplikacja webowa do generowania pełnego, kołowego,
sześciotygodniowego harmonogramu pracy trzech wychowawców jednej grupy
internatu Młodzieżowego Ośrodka Wychowawczego.

Backend waliduje dane, oblicza zapotrzebowanie dla 42 dat i buduje model
ograniczeń OR-Tools CP-SAT. Znaleziony kandydat jest publikowany dopiero po
ponownym sprawdzeniu przez niezależny walidator. Frontend nie odtwarza logiki
solvera ani reguł krytycznych.

> **Ważne:** dołączony profil prawny i wszystkie dane przykładowe mają status
> `UNVERIFIED` oraz służą wyłącznie demonstracji. Nie wolno używać
> demonstracyjnego wyniku do rzeczywistego planowania pracy. Tryb produkcyjny
> wymaga profilu `VERIFIED` z kompletnym śladem zatwierdzenia i zakresem
> obowiązywania obejmującym cały cykl.

## Najważniejsze funkcje

- jedna grupa i dokładnie trzech aktywnych wychowawców;
- cykl 6 tygodni × 7 dni, rozpoczynający się w poniedziałek;
- półgodzinowy model czasu i odcinki o długości co najmniej 120 minut;
- dokładnie pięć dni pracy każdej osoby w każdym tygodniu;
- podstawowe i zatwierdzone zastępcze przydziały tygodniowe;
- plany `BASE_WEEKLY`, `CYCLE_WEEK` i `SPECIFIC_DATE`;
- dynamiczne zapotrzebowanie jako różnica zbiorów przedziałów;
- niedostępności `HARD` i `PREFERRED`;
- sześć dokładnych, zatwierdzonych wzorców weekendowych i warianty
  `SUBSTITUTE`;
- odpoczynek dobowy i tygodniowy liczony na osi czasu w jawnej strefie IANA;
- obsługa nieistniejących i niejednoznacznych granic czasu lokalnego;
- rozdzielone statusy błędnych danych, braku rozwiązania, limitu czasu,
  błędu wewnętrznego i poprawnego wyniku;
- polskie raporty zawierające stabilne `ruleId`;
- tygodniowy i osobowy widok harmonogramu na komputerze i telefonie;
- trwały lokalny zapis konfiguracji, wyniku i raportu w `localStorage`.

## Wymagania

- Python 3.12 lub nowszy;
- Node.js 20 lub nowszy;
- npm 10 lub nowszy;
- systemowa baza stref czasowych albo paczka `tzdata` instalowana z
  `requirements.txt`.

Polecenia poniżej są zapisane dla PowerShell na Windows. Na macOS/Linux należy
użyć odpowiednio `python3`, `source backend/.venv/bin/activate` oraz ścieżki
`backend/.venv/bin/python`.

## Instalacja

W głównym katalogu projektu:

```powershell
python -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
npm.cmd install
npm.cmd --prefix frontend install
```

Projekt nie wymaga bazy danych ani zewnętrznej usługi trwałego składowania.

## Uruchomienie

Cała aplikacja jednym poleceniem:

```powershell
npm.cmd run dev
```

Adresy:

- frontend: <http://127.0.0.1:5173>
- backend: <http://127.0.0.1:8000>
- dokumentacja OpenAPI: <http://127.0.0.1:8000/docs>

Osobne uruchomienie backendu:

```powershell
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --app-dir backend --port 8000
```

Osobne uruchomienie frontendu:

```powershell
npm.cmd --prefix frontend run dev
```

Vite przekazuje żądania `/api` do backendu na porcie `8000`.

## Dane demonstracyjne

1. Otwórz stronę startową.
2. Wybierz **Otwórz demonstrację**.
3. Przejdź do **Podsumowania** i wybierz **Sprawdź dane**.
4. Po uzyskaniu `VALID_INPUT` wybierz **Generuj harmonogram**.
5. Otwórz **Raport walidacji**.

Fixture zawiera:

- grupę demonstracyjną i osoby A, B, C;
- cykl od poniedziałku `2026-09-14`;
- strefę `Europe/Warsaw`;
- 7 planów bazowych i jeden pełny wyjątek daty;
- jeden zastępczy przydział godzin;
- przykłady `HARD` i `PREFERRED`;
- sześć wariantów weekendowych;
- jawny podział demonstracyjny `06:00–14:00` i `14:00–22:00`;
- testowe wartości odpoczynków 11 i 35 godzin;
- profil `UNVERIFIED` i tryb `DEMONSTRATION`.

Fixture jest wykonalny. Generuje 123 ciągłe odcinki, zachowuje weekendy 1:1 i
kończy się wynikiem `POPRAWNY_TRYB_DEMONSTRACYJNY` oraz raportem `VALID`.
Liczba odcinków jest deterministyczna dla zapisanej wersji fixture, parametrów
solvera i wersji OR-Tools.

## API

| Metoda | Endpoint | Przeznaczenie |
|---|---|---|
| `GET` | `/api/health` | kontrola działania backendu |
| `GET` | `/api/demo` | kompletna konfiguracja demonstracyjna |
| `POST` | `/api/validate-input` | walidacja danych i bilansów |
| `POST` | `/api/calculate-care` | zapotrzebowanie dla 42 dat |
| `POST` | `/api/generate` | uruchomienie CP-SAT i niezależnej walidacji |
| `POST` | `/api/validate-schedule` | kontrola przekazanego harmonogramu |

Wszystkie modele są opisane w automatycznie generowanym OpenAPI.

## Testy

Wszystkie testy:

```powershell
npm.cmd test
```

Tylko backend:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend\tests
```

Tylko frontend:

```powershell
npm.cmd --prefix frontend test
```

Kontrola TypeScript i build produkcyjny:

```powershell
npm.cmd --prefix frontend run build
```

Zestaw backendowy obejmuje poziomy `INPUT_VALIDATION`, `CALCULATOR_UNIT`,
`RULE_VALIDATOR_UNIT`, `SOLVER_INTEGRATION` i `END_TO_END`, między innymi:
hierarchię planów, bilanse, normalizację, zmianę czasu, odpoczynki, twarde i
preferowane niedostępności, dokładne weekendy, luki, nakładanie, pracę poza
zapotrzebowaniem, błąd pola pochodnego, deterministyczność i limit czasu.

## Struktura

```text
/
├── backend/
│   ├── app/
│   │   ├── api/          # endpointy FastAPI
│   │   ├── domain/       # ruleId i stałe domenowe
│   │   ├── fixtures/     # kompletna demonstracja
│   │   ├── models/       # modele Pydantic
│   │   ├── services/     # czas, zapotrzebowanie, cel i orkiestracja
│   │   ├── solver/       # model OR-Tools CP-SAT
│   │   └── validation/   # wejście i niezależny walidator wyniku
│   └── tests/
├── frontend/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── state/
│       └── test/
├── docs/
└── README.md
```

Aktywne dokumenty wymagań pozostają w głównym katalogu repozytorium.
Historyczne raporty spójności nie zostały zmodyfikowane przez implementację.

## Ograniczenia V1

- dokładnie jedna grupa i trzy osoby, bez rezerwy i puli międzygrupowej;
- brak bazy danych, kont użytkowników, uprawnień i pracy wielostanowiskowej;
- konfiguracja i wyniki są przechowywane w przeglądarce;
- brak importu/eksportu JSON w interfejsie;
- brak automatycznego tworzenia zastępstw i wariantów weekendowych;
- raport konfliktu solvera ma jawnie oznaczoną jakość `APPROXIMATE` i nie
  deklaruje minimalnego rdzenia sprzeczności;
- wynik nie jest publikowany po limicie czasu, nawet jeśli solver znalazł
  nieudowodnionego kandydata;
- prawdziwe użycie wymaga zastąpienia danych demonstracyjnych zatwierdzonymi
  danymi placówki oraz profilem prawnym `VERIFIED`.
