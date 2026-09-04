# Harmonogram MOW

### Izolacja grup i pobudki (1.7.0)

- Konfiguracja → Dodaj kolejną grupę → Plik grupy do dołączenia dodaje dane osobno zapisanej grupy, bez zastępowania bieżącego projektu. Aby zachować dobry wynik VI, wczytaj pełny projekt VI, potem dołącz plik VII. Identyczne wewnętrzne G1/A/B/C są remapowane razem z powiązaniami. Wymagane są zgodne daty i parametry reguł; duplikat oznaczenia lub dokładnie tej samej osoby zatrzymuje import zamiast tworzyć ukrytą drugą kopię. Wspólne osoby wymagają osobnego uzgodnienia. Przed zmianą zachowywana jest lokalna kopia obu projektów; brak miejsca przerywa operację. Importowane dane zaczynają poza obliczeniami. Oddzielnych wyników nie uznaje się automatycznie za wspólnie zweryfikowany harmonogram.
- W Konfiguracji wybierasz konkretne oznaczenie nowej grupy (np. VII), nie liczbę pierwszych grup. Nowa grupa ma nowe identyfikatory, trzy puste karty osób, siedem niezatwierdzonych pustych dni i brak weekendów. Nie dziedziczy godzin, nocek, dostępności, członkostw ani zatwierdzeń innej grupy. Daty i ogólne reguły pozostają wspólne dla projektu.
- Usunięto liczbową operację kasującą końcowe grupy i pozycyjne kopiowanie całej konfiguracji między osobami. Zakres obliczeń wybierasz checkboxami konkretnych grup. Odłączenie zachowuje dane. Dodanie pustej, niedołączonej grupy zachowuje wcześniejszy poprawny wynik. Wspólne generowanie nadal przelicza dołączone grupy — nie jest zamrożeniem poprzedniego planu.
- Informacja o osobach bez opieki dziennej w weekend wynika z obsady. Starsze sprzeczne pole `offEducatorId` jest uzgadniane na kopii żądania, bez zmiany dyżurów, nocek i wzorców dni wolnych. Działa również dla starego klienta i zastępstw, przy 3 i 4 osobach.
- Brak obliczonego zapotrzebowania nie jest zerowym zapotrzebowaniem: walidacja nie dopisuje fikcyjnych błędów dyżurów ani braków godzin do błędu wcześniejszego etapu. Faktyczne konflikty poza obliczonym czasem opieki nadal blokują wynik.
- Generowanie 1–8 grup korzysta z jednego modelu. Krótka opcjonalna poprawa preferuje równy rozkład porannych dni pn–pt (praca pokrywająca 06:00–08:00), osobno dla każdej grupy i tygodnia. Stały plan częściowy nie jest rozdzielany ponownie. Preferencje wolnego i zaznaczonych dojazdów mają pierwszeństwo przed wyrównywaniem poranków; wymagane warunki zawsze pozostają twarde. Cztery poranki nie są nowym zakazem: gotowy plan otrzymuje konkretną informację o liczbach, nie błąd.
- Testy obejmują dodawanie do ośmiu grup bez zmiany danych istniejącej grupy, VI+VII z sześcioma szkicami poza zakresem, zachowanie wyniku, stare etykiety weekendów, brak kaskady błędów, rozkład pobudek per grupa i zachowanie planu po końcu czasu ulepszania.

### Aktualizacje i instalacja Windows (1.6.1)

Po wykryciu gotowej poprawki pojawia się „Odśwież aplikację”. Sprawdzenie następuje przy uruchomieniu, powrocie do okna i odzyskaniu połączenia, nie częściej niż raz na minutę. Zapisz formularze przed odświeżeniem. Trwające generowanie blokuje przycisk. Dodatkowa kopia zapisanego projektu i planu trafia do lokalnego klucza `harmonogram-mow-before-update-v1`; aktualizacja nie kasuje danych. Aktywacja w innej karcie nie wymusza przeładowania bieżącego formularza.

Link instalacyjny: https://jarekdymek.github.io/Harmonogram/instalacja/ . PWA instaluje się przez Edge/Chrome w tym samym profilu przeglądarki, bez pobierania EXE i bez wyłączania Defendera/SmartScreen. Nie gwarantujemy braku ograniczeń administratora lub ostrzeżeń przeglądarki. Dane między różnymi profilami, przeglądarkami i urządzeniami przenosi się przez Eksport i import.

### Preferencje i prowadzenie krok po kroku (1.6.0)

- **Weekendy → sposób planowania wolnego:** dwa kolejne dni od poniedziałku do piątku; dodatkowa opcja preferuje poniedziałek i wtorek po **wolnym** weekendzie. Każdy tydzień jest oceniany osobno. W planie skończonym wcześniejszy weekend pierwszego tygodnia jest nieznany; w cyklu sprawdzamy ostatni weekend. Obowiązkowe dyżury, szkoła i obie daty nocki mają pierwszeństwo. Niespełnione życzenie nie blokuje poprawnego planu.
- **Wychowawcy → Preferuj jeden przyjazd dziennie:** koszt dodatkowego oddzielnego odcinka tej osoby jest trzykrotny. Stykające się dyżury dołączonych grup tworzą jeden blok. Pierwsza propozycja korzysta z krótkiej, ograniczonej czasowo próby poprawy; nieudana próba nie usuwa poprawnej propozycji. Dalszą optymalizację uruchamia przycisk ulepszania podziału.
- **Reguły:** rozwijane objaśnienia parametrów; czerwone ostrzeżenia przy odejściu od ogólnych norm odpoczynku i pięciu dni pracy. Edycja pozostaje dostępna, również dla parametrów wyłączonego wyjątku. Zapis nie jest certyfikatem legalności. Historyczne wagi są opisane jako niekontrolujące obecnej kolejności celów solvera.
- **Nowy projekt:** domyślnie tryb rzeczywisty i zatwierdzenie użytkownika Jarosław Dymek, datowane na dzień utworzenia, ważne rok. Daty nie odnawiają się podczas uruchamiania. Początkową przykładową strukturę trzeba sprawdzić i potwierdzić w Konfiguracji przed generowaniem. Istniejące projekty i ich profile pozostają bez zmian. Demonstracja jest dostępna osobno w Regułach; przed jej wczytaniem powstaje lokalna kopia projektu z planem, dostępna do przywrócenia w Eksport i import.
- **Przewodnik:** sprawdza kompletność dołączonych grup, a nie wykonalność. Formularze można zwijać; link naprawy otwiera sekcję i wskazuje pole. Błędy pokazują opis, osobę i datę przed szczegółami technicznymi. Pomocnicze próby diagnostyczne są jawnie oznaczone i nigdy nie są publikowane jako poprawny plan. Jeśli przyczyny nie ustalono w budżecie, aplikacja nie wymyśla winnego pola.

Podstawowe odniesienie prawne: [PIP — czas pracy](https://www.pip.gov.pl/dla-pracownikow/porady-prawne/czas-pracy). Zastosowanie wyjątków, Karty Nauczyciela i regulaminu placówki wymaga sprawdzenia właściwego dla danej osoby. Domyślne 5 dni pozostaje regułą; ręczna zmiana wymaga świadomej oceny podstawy.

### Stała nocka w łącznym wymiarze (1.5.1)

Dodanie, usunięcie lub przeniesienie stałej nocki nie zmienia wpisanego wymiaru tygodniowego.
28,5 godziny łącznie oznacza 20,5 godziny opieki + 8 godzin stałej nocki.
Starsze zawyżone zapisy można poprawić w karcie wychowawcy: „Starsza wersja doliczyła nockę ponad wymiar?”.
Korekta pokazuje nowe wartości każdego tygodnia, wymaga zatwierdzenia i zachowuje lokalną kopię konfiguracji.
Nie zmienia automatycznie godzin innych osób ani nie usuwa nocek. Dodatkowe nocki/nadgodziny pozostają oddzielne.

### Ręczne dołączanie grup (1.5.0)

Panel „Grupy dołączone do generowania” oddziela oglądaną grupę od zakresu
obliczeń. „Dołącz tę grupę i wygeneruj” dodaje bieżącą grupę do zaznaczonych;
odznaczenie zawiesza grupę bez usuwania danych. Pusty zakres nie uruchamia
generatora. Braki obsady, planów i weekendów odłączonych grup nie blokują
wybranego zakresu. Znane obowiązkowe zajęcia wspólnych wychowawców nadal
chronią przed kolizjami i naruszeniem odpoczynku.

Status gotowego planu dotyczy grup obecnych w wyniku, nie aktualnie
przeglądanej grupy. Nieudane rozszerzenie zakresu zachowuje poprzedni
poprawny wynik i pokazuje osobno błędy nowej próby. Edycja niezależnej
zawieszonej grupy nie kasuje planu; zmiana jego danych zapisuje lokalną
kopię przed unieważnieniem wyniku.

W „Weekendy” można utworzyć brakujące pozycje 1–6 dla aktywnej grupy,
wybrać jej wychowawców i dodawać lub usuwać odcinki. Nowe formularze nie
kopiują obsady innych grup. Uzupełnienie i zapis zatwierdza wzorce.

Responsywna aplikacja webowa do wspólnego generowania harmonogramu od jednej
do ośmiu grup internatu Młodzieżowego Ośrodka Wychowawczego, dla horyzontu od
jednego do sześciu tygodni. Każda grupa ma trzech wychowawców podstawowych oraz
opcjonalnego czwartego wychowawcę uzupełniającego.

Backend waliduje dane, oblicza zapotrzebowanie dla wybranego zakresu i buduje model
ograniczeń OR-Tools CP-SAT. Znaleziony kandydat jest publikowany dopiero po
ponownym sprawdzeniu przez niezależny walidator. Frontend nie odtwarza logiki
solvera ani reguł krytycznych.

## Aktualna kolejność układania planu

1. Obowiązkowy dyżur w internacie już zapewnia opiekę w podanych godzinach.
2. Generator układa tylko pozostałą obsadę. Obowiązkowy dyżur ma pierwszeństwo
   także przed wzorcem weekendowym; nie trzeba ręcznie skracać sześciu wzorców.
3. Zapisane zapotrzebowanie i wymiary godzin nie są zmniejszane ani nadpisywane.
   Godziny stałego dyżuru liczą się raz do obsady i wymiaru jego wychowawcy.
4. Nie wolno naruszać dostępności, odpoczynków ani limitów dni pracy. Dwa
   sprzeczne obowiązkowe dyżury pozostają błędem, nie rozstrzyga ich kolejność wpisu.
5. Nieustalona przyczyna nie jest prezentowana jako gotowy „plan naprawy”.
   Diagnostyka pomocnicza ma wspólny ograniczony budżet obliczeń.

### Dwa kolejne dni wolne za weekend

W kroku **Weekendy** każda osoba ma wybór: **Obowiązkowe wskazane dni** albo
**Preferuj dwa kolejne dni — wybiera generator**. Dotychczasowe wpisy pozostają
obowiązkowe, dopóki użytkownik sam nie zmieni trybu. Preferencja działa tylko
w tygodniu z pracującym weekendem i dotyczy dwóch kolejnych dat w tym samym
tygodniu poniedziałek–niedziela. Obie daty nocki i praca w szkole liczą się jako praca.

Generator najpierw znajduje poprawny plan, następnie w ograniczonym czasie
próbuje zmniejszyć liczbę niespełnionych preferencji. Nie odrzuca planu, gdy
nie uda się uzyskać kolejnych dni wolnych: ostrzeżenie podaje osobę, tydzień
i rzeczywiste dni wolne. Nie przedstawia końca czasu poszukiwań jako dowodu
niemożliwości. Godziny, obsada, obowiązkowe dyżury i odpoczynki pozostają wymagane.

Kontrola możliwości przydzielenia godzin nie liczy ponownie opieki już pokrytej
obowiązkowym dyżurem innej osoby. Przy konflikcie solvera z obowiązkowymi
wzorcami raport wskazuje wspólnie sprzeczne wzorce i tygodnie; taki zestaw
nie oznacza, że każdy wymieniony wpis z osobna jest błędem.

Dokumenty opisujące **pierwszą wersję / V1** są historyczne. Ich wykluczenie
czwartego wychowawcy, stałych dyżurów, importu i eksportu nie opisuje obecnej aplikacji.

> **Ważne:** dołączony profil prawny i wszystkie dane przykładowe mają status
> `UNVERIFIED` oraz służą wyłącznie demonstracji. Nie wolno używać
> demonstracyjnego wyniku do rzeczywistego planowania pracy. Tryb produkcyjny
> wymaga profilu `VERIFIED` z kompletnym śladem zatwierdzenia i zakresem
> obowiązywania obejmującym cały cykl.

## Gotowe wersje

### Pobieranie Worda

W kroku **Harmonogram** gotowy wynik jest automatycznie przygotowywany do Worda
dla wszystkich tygodni. **Pobierz Word (.docx)** jest bezpośrednim odnośnikiem,
który można nacisnąć ponownie bez ponownego generowania planu. Na telefonach
obsługujących pliki dostępne jest także **Udostępnij plik**. Pliku należy szukać
w Pobranych przeglądarki lub w wybranym folderze. Błąd eksportu nie usuwa planu.

### Instalacja

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

Domyślna reguła organizacyjna aplikacji wymaga **dokładnie 5 dni pracy w tygodniu
poniedziałek–niedziela**, a nie samego maksimum 5. Czterodniowy wyjątek nie jest
włączany automatycznie. Art. 42c Karty Nauczyciela przewiduje pięciodniowy
tydzień dla pełnego wymiaru oraz określone wyjątki wymagające decyzji dyrektora
([tekst jednolity 2026, art. 42c](https://api.sejm.gov.pl/eli/acts/DU/2026/515/text.pdf)).
Ta kontrola i osobisty wzorzec wolnego nie są pełnym audytem prawa: nie
potwierdzają statusu zatrudnienia, wszystkich warunków wolnych niedziel ani
profilu prawnego placówki. Wynik walidatora starszego niż 3.1.0 wymaga ponownego
generowania; przed migracją aplikacja zachowuje osobną lokalną kopię danych i
poprzedniego wyniku.

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
- dokładnie pięć kalendarzowych dni pracy każdej osoby objętej planem w tygodniu, łącznie ze szkołą i obiema datami nocki;
- stały osobisty wzorzec dwóch dni całkowicie wolnych za pracujący weekend (krok 5):
  obowiązuje w tym samym tygodniu poniedziałek–niedziela we wszystkich grupach;
  uruchamia go także nocka lub szkoła w sobotę/niedzielę;
  kolizja wskazuje osobę, datę i wzorzec do poprawy, bez automatycznego usuwania dyżurów;
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
- edytowalny eksport aktywnej grupy do Worda `.docx`: cały horyzont 1–6
  tygodni, jeden tydzień na stronie A4 w układzie poziomym;
- wersjonowany lokalny zapis konfiguracji, wyniku i raportu w `localStorage`;
- prywatny, niezależny od urządzenia eksport/import pełnego projektu
  `.harmonogram.json`, obejmujący konfigurację, raport oraz zgodny,
  zwalidowany plan; starsze pakiety samej konfiguracji pozostają obsługiwane;
- stałe nocki wybierane jako osoba i dzień tygodnia, automatycznie rozwijane
  do dyżurów 22:00–06:00 w każdym tygodniu planu;
- jawny „stały plan pomocniczy” dla wychowawcy dochodzącego: jego ręcznie
  wpisane obowiązkowe dyżury muszą pokrywać cały wymiar w grupie, są blokowane
  w każdym tygodniu, a reguła dokładnie pięciu dni pozostaje obowiązkowa dla
  wychowawców podstawowych;
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
2. W zakładce **Reguły** rozwiń narzędzia demonstracyjne i wybierz **Otwórz demonstrację**.
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
  plikiem projektu `.harmonogram.json` z podglądem i lokalną kopią
  bezpieczeństwa przed importem; adres backendu nie jest przenoszony, ponieważ
  pozostaje właściwością konkretnej instalacji;
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
