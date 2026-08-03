# Interpretacja harmonogramu referencyjnego

## Źródło i przeznaczenie

Fixture `backend/app/fixtures/internat_week_42_2026.json` jest strukturalnym
odczytem dokumentu `42. 15 - 21. 06.2026r. (1).docx`. Dokument przedstawia
tydzień 42 obejmujący 15–21 czerwca 2026 r. i osiem grup internatu.

Fixture jest przykładem rzeczywistego układu całego internatu oraz danymi do
testów migracji, widoków i kontroli kolizji. Nie jest konfiguracją prawną ani
wzorcem, który solver ma bezwarunkowo odtwarzać.

## Mapowanie tabeli

- Wiersze `I`–`VIII` reprezentują grupy `G1`–`G8`.
- Kolumny od poniedziałku do niedzieli reprezentują daty
  `2026-06-15`–`2026-06-21`.
- Każda para godzin i nazwiska została zapisana jako osobny, chronologiczny
  element `dailyAssignments`.
- Prawa kolumna jest zapisana jako `educatorHourSummary`. Są to wartości
  wydrukowane w dokumencie, a nie wynik ponownego obliczenia.
- Wiersz `NOC` został zapisany jako zablokowane `externalDutyAssignments`
  typu `NIGHT`. Noc może przechodzić przez północ, lecz dzienny odcinek opieki
  grupowej nie może.
- Dolny wiersz `Grupa N` został zapisany jako `commonAreaDuties` typu
  `DINING_ROOM`; wskazuje grupę, a nie dodatkowe godziny konkretnej osoby.

## Wychowawcy i członkostwa

Nazwisko oznacza jedną osobę w globalnym rejestrze także wtedy, gdy występuje
w kilku grupach. Każda osoba użyta w komórkach grupy ma członkostwo w tej
grupie. Wartość z prawej kolumny jest wymiarem referencyjnym. Dla osoby
obecnej w komórce, lecz niewymienionej w podsumowaniu, fixture przechowuje rolę
`SUPPORT` i sumę odczytanych odcinków z jawną adnotacją o jej pochodzeniu.

## Jawne niejednoznaczności źródła

- Dokument nie określa, czy podsumowania obejmują obowiązki spoza tabeli grup,
  dlatego fixture przechowuje odcinki i podsumowania osobno.
- Zapis `600 800 Polkowski` w grupie VII z 16 czerwca nie ma widocznego
  łącznika; zgodnie z układem tabeli został odczytany jako `06:00–08:00`.
- Pierwsza komórka wiersza nocnego zawiera dwa odcinki:
  `00:00–06:00 Piechota` oraz noc `22:00–06:00 Dembiński`.
- Ostatni odcinek `22:00–24:00 Kruk` kończy się 22 czerwca o `00:00`.
- Nazwiska, daty, liczba grup i godziny są danymi referencyjnymi, a nie
  uniwersalnymi stałymi aplikacji.

## Reguła zakazu powrotu

Dokument historyczny może zawierać układ `A–B–A`, np. w grupie VI
18 czerwca. Fixture zachowuje zapis źródłowy. Nowy generator nie może utworzyć
takiego układu w jednym ciągłym bloku opieki, a niezależny walidator zgłasza
naruszenie `REQ-NO-RETURN-WITHIN-BLOCK-001`.
