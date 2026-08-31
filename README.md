# Harmonogram MOW

Responsywna aplikacja webowa do wspólnego generowania harmonogramu od jednej
do ośmiu grup internatu Młodzieżowego Ośrodka Wychowawczego, dla horyzontu od
jednego do sześciu tygodni. Każda grupa ma trzech wychowawców podstawowych oraz
opcjonalnego czwartego wychowawcę uzupełniającego.

Backend waliduje dane, oblicza zapotrzebowanie dla wybranego zakresu i buduje model
ograniczeń OR-Tools CP-SAT. Znaleziony kandydat jest publikowany dopiero po
ponownym sprawdzeniu przez niezależny walidator. Frontend nie odtwarza logiki
solvera ani reguł krytycznych.

> **Ważne:** dołączony profil prawny i wszystkie dane przykładowe mają status
> `UNVERIFIED` oraz służą wyłącznie demonstracji. Nie wolno używać
> demonstracyjnego wyniku do rzeczywistego planowania pracy. Tryb produkcyjny
> wymaga profilu `VERIFIED` z kompletnym śladem zatwierdzenia i zakresem
> obowiązywania obejmującym cały cykl.

## Gotowe wersje

- **PWA:** <https://jarekdymek.github.io/Harmonogram/> — instalowana z
  przeglądarki na komputerze lub telefonie;
- **Windows:** [najnowszy instalator
  `Harmonogram-MOW-Setup.exe`](https://github.com/JarekDymek/Harmonogram/releases/latest).

Instalator Windows zawiera frontend, backend FastAPI, solver OR-Tools i własne
okno aplikacji. Na komputerze użytkownika nie są wymagane Python ani Node.js.

PWA przechowuje interfejs i konfigurację lokalnie, ale celowo nie buforuje
wyników API ani logiki solvera. Do generowania potrzebuje publicznego backendu
HTTPS. Adres backendu można wpisać na ekranie startowym; pozostawienie pustego
pola oznacza API dostępne pod tym samym adresem.

## Najważniejsze funkcje

- od 1 do 8 grup z osobnymi planami, wyjątkami i wzorcami weekendowymi;
- globalny rejestr wychowawców i członkostwa `PRIMARY` / `SUPPORT`;
- usunięcie członkostwa nie wymaga kasowania osoby z rejestru: bez dyżurów
  nie generuje ona błędu odpoczynku; rzeczywiste dyżury poza grupą nadal podlegają kontroli;
- jedna osoba może pracować w kilku grupach, ale nigdy jednocześnie;
- globalne liczenie odpoczynków, dni pracy, niedostępności i godzin;
- osobny widok aktywnej grupy i tabelaryczny widok całego internatu;
- zablokowane dyżury nocne oraz grupowe dyżury w stołówce;
- horyzont 1–6 tygodni, rozpoczynający się w poniedziałek;
- granice w trybie skończonym albo cyklicznym (cykl tylko dla 6 tygodni);
- półgodzinowy model czasu i odcinki o długości co najmniej 120 minut;
- najwyżej pięć kalendarzowych dni pracy każdej osoby w tygodniu, łącznie ze szkołą i nockami;
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
- wersjonowany lokalny zapis konfiguracji, wyniku i raportu w `localStorage`;
- prywatny eksport/import pełnej konfiguracji między komputerem i telefonem;
- stałe nocki wybierane jako osoba i dzień tygodnia, automatycznie rozwijane
  do dyżurów 22:00–06:00 w każdym tygodniu planu;
- nocka 22:00–06:00 zajmuje oba dni pracy; w te dni dodatkowa opieka jest dozwolona tylko 20:00–22:00 i 06:00–08:00;
- obowiązkowe dyżury tygodniowe: generator musi zachować osobę, dzień i godziny;
- praca w szkole: blokuje rzeczywiste godziny, wlicza się do dni pracy i odpoczynków, nie do wymiaru grupy;
- łączny wymiar grupy obejmuje stałe nocki (8 godz. każda), a pozostałe godziny trafiają do opieki dziennej;
- jeden przycisk na podsumowaniu sprawdza dane i, gdy nie ma błędów, od razu
  uruchamia generator;
- blokujące konflikty wskazują osobę, datę, godziny i dokładne miejsce poprawy;
- interfejs godzinowy z obsługą polskiego przecinka i krokiem 0,5 godziny.
- twardy zakaz powrotu `A–B–A` w jednym ciągłym bloku opieki;
- równoważna optymalizacja leksykograficzna: dni dzielone, przekazania,
  liczba osób, odcinki, `PREFERRED`, długość i godzina przekazania;
- kanoniczne scalanie sąsiadujących slotów i tygodniowy raport jakości.

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

### Instalator Windows

1. Otwórz stronę [Releases](https://github.com/JarekDymek/Harmonogram/releases).
2. Pobierz `Harmonogram-MOW-Setup.exe`.
3. Uruchom instalator i opcjonalnie zaznacz utworzenie ikony na pulpicie.
4. Uruchom **Harmonogram MOW** z menu Start.

Windows może wyświetlić ostrzeżenie SmartScreen, ponieważ pierwsze wydania nie
są podpisane komercyjnym certyfikatem. Plik jest budowany automatycznie z kodu
tego repozytorium przez GitHub Actions. Każde wydanie zawiera
`SHA256SUMS.txt` do kontroli integralności. Aplikacja używa systemowego
Microsoft Edge WebView2.

### PWA z GitHub Pages

1. Otwórz <https://jarekdymek.github.io/Harmonogram/>.
2. W Chrome lub Edge wybierz ikonę instalacji w pasku adresu albo przycisk
   **Zainstaluj aplikację**.
3. Na ekranie startowym wpisz publiczny adres backendu HTTPS i wybierz
   **Zapisz i sprawdź**.

Sam GitHub Pages nie uruchamia Pythona ani OR-Tools. Backend można wdrożyć z
tego repozytorium przyciskiem:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/JarekDymek/Harmonogram)

Blueprint `render.yaml` tworzy usługę z `Dockerfile`, kontrolą
`/api/health` i CORS ograniczonym do `https://jarekdymek.github.io`. Po
wdrożeniu skopiuj adres `https://...onrender.com` do ustawień PWA. Opcjonalnie
można zapisać go jako zmienną repozytorium `PWA_API_BASE_URL`; kolejne
wdrożenie Pages wbuduje go jako wartość domyślną.

### Instalacja deweloperska

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

Backend potrafi także serwować build frontendu z `frontend/dist`. Jest to tryb
używany przez pakiet desktopowy:

```powershell
npm.cmd --prefix frontend run build:desktop
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --port 8000
```

## Dane demonstracyjne

1. Otwórz stronę startową.
2. Wybierz **Otwórz demonstrację**.
3. Przejdź do **Podsumowania** i wybierz **Sprawdź i wygeneruj harmonogram**.
4. Jeśli dane są poprawne, aplikacja sama uruchomi generator.
5. Otwórz **Raport walidacji**.

Demonstracja zawiera:

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

Demonstracja jest wykonalna, kończy się wynikiem
`POPRAWNY_TRYB_DEMONSTRACYJNY` oraz raportem `VALID`. Repozytorium zawiera też
znormalizowany fixture rzeczywistego tygodnia 42 z 2026 r.: osiem grup, 156
odcinków grupowych, osiem dyżurów nocnych i siedem dyżurów stołówkowych. Sposób
odczytu opisuje `docs/INTERPRETACJA_HARMONOGRAMU_REFERENCYJNEGO.md`.

## API

| Metoda | Endpoint | Przeznaczenie |
|---|---|---|
| `GET` | `/api/health` | kontrola działania backendu |
| `GET` | `/api/demo` | kompletna konfiguracja demonstracyjna |
| `POST` | `/api/validate-input` | walidacja danych i bilansów |
| `POST` | `/api/calculate-care` | zapotrzebowanie dla wybranego horyzontu |
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

Build GitHub Pages:

```powershell
npm.cmd --prefix frontend run build:pages
```

Build instalatora jest wykonywany na runnerze Windows przez workflow
`.github/workflows/release-windows.yml`. Tag w formacie `v1.3.0` tworzy
wydanie GitHub Release i dołącza gotowy `Harmonogram-MOW-Setup.exe`.

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
├── desktop/             # launcher WebView2, PyInstaller i Inno Setup
├── .github/workflows/   # wdrożenie PWA i budowanie instalatora
├── Dockerfile
├── render.yaml
├── docs/
└── README.md
```

Aktywne dokumenty wymagań pozostają w głównym katalogu repozytorium.
Historyczne raporty spójności nie zostały zmodyfikowane przez implementację.

## Rzeczywiste ograniczenia

- brak bazy danych, kont użytkowników, uprawnień i pracy wielostanowiskowej;
- konfiguracja i wyniki są przechowywane w przeglądarce;
- dane nie synchronizują się automatycznie; użytkownik przenosi je prywatnym
  pakietem `.harmonogram.json` z podglądem przed importem;
- brak automatycznego tworzenia zastępstw i wariantów weekendowych;
- raport konfliktu solvera ma jawnie oznaczoną jakość `APPROXIMATE` i nie
  deklaruje minimalnego rdzenia sprzeczności;
- domyślny generator buduje tylko model wymaganych warunków i kończy po
  znalezieniu pierwszego planu; niezależna kontrola musi zwrócić `VALID`;
- propozycja nie czeka na idealny podział preferencji. Osobne „Spróbuj ulepszyć
  podział” uruchamia optymalizację; pusty, odrzucony lub gorszy wynik nie zastępuje
  dotychczasowego poprawnego planu;
- PWA daje pierwszej próbie co najmniej 60 sekund obliczeń; „Szukaj dłużej” daje
  co najmniej 180 sekund bez zmiany zapisanej konfiguracji. Limit bez kandydata
  nie jest dowodem sprzeczności danych. API obsługuje `POST /api/generate?optimize=true`
  jako osobne żądanie ulepszania; `/api/health` identyfikuje wersję generatora;
- stałe dyżury nocne są blokowane automatycznie w każdym tygodniu; dodatkowe
  nocki i nadgodziny nadal wymagają wskazania konkretnej daty;
- dzień wskazany przy stałej nocce jest dniem jej rozpoczęcia; standardowy
  dyżur trwa od 22:00 do 06:00 następnego dnia i liczy się jako jeden dzień
  pracy, natomiast kolizje i odpoczynki uwzględniają cały rzeczywisty przedział;
- dyżur stołówkowy jest obecnie informacyjnym przydziałem grupy bez godzin
  konkretnej osoby;
- prawdziwe użycie wymaga zastąpienia danych demonstracyjnych zatwierdzonymi
  danymi placówki oraz profilem prawnym `VERIFIED`.
