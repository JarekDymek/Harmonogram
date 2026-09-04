import { useState, type ChangeEvent } from "react";
import { migrateConfiguration, useAppState } from "../state/AppState";
import { createProjectTransferPackage, MAX_TRANSFER_FILE_BYTES, parseDeviceTransferPackage, type ProjectTransferPackage } from "../transfer";
import { mergeGroupConfiguration } from "../mergeGroup";

export function GroupImport({hasUnsavedChanges}: {hasUnsavedChanges: boolean}) {
  const {configuration, setConfiguration, generation, inputReport, busy} = useAppState();
  const [source, setSource] = useState<ProjectTransferPackage | null>(null);
  const [message, setMessage] = useState("");
  const select = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; setSource(null);
    if (!file || !configuration) return;
    try {
      if (file.size > MAX_TRANSFER_FILE_BYTES) throw new Error("Maksymalny rozmiar pliku to 5 MB.");
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Nie odczytano pliku.")); reader.readAsText(file);
      });
      const parsed = parseDeviceTransferPackage(text);
      parsed.configuration = migrateConfiguration(parsed.configuration);
      mergeGroupConfiguration(configuration, parsed.configuration); // Validate without any writes.
      setSource(parsed); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Nie dołączono grupy."); }
  };
  const merge = () => {
    if (!configuration || !source || busy) return;
    if (hasUnsavedChanges) { setMessage("Najpierw zapisz zmiany formularza Konfiguracja. Nie dołączono grupy."); return; }
    try {
      const next = mergeGroupConfiguration(configuration, source.configuration);
      localStorage.setItem("harmonogram-before-group-merge-v1", JSON.stringify({
        current: createProjectTransferPackage(configuration, inputReport, generation), incoming: source,
      }));
      setConfiguration(next);
      setMessage(`Dodano dane grupy ${source.configuration.groups[0].code}. Dotychczasowy projekt zachowano. Nowa grupa jest poza obliczeniami, dopóki jej nie dołączysz. Gotowy plan z importowanego pliku nie został uznany za wspólnie sprawdzony wynik.`);
      setSource(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Nie udało się zachować kopii. Nie dołączono grupy."); }
  };
  return <section>
    <h3>Masz grupę w osobnym pliku?</h3>
    <p>Aby zachować dobry plan VI, najpierw wczytaj jego projekt przez Eksport i import, a tutaj dodaj dane VII. Ta operacja dodaje jedną grupę bez zastępowania pozostałych. Nie łączy dwóch oddzielnych wyników w pozornie sprawdzony wspólny plan. Wspólne generowanie może zmienić podział dyżurów.</p>
    <label>Plik grupy do dołączenia<input type="file" accept=".json" onChange={select} disabled={busy}/></label>
    {source && <div><p>Do dodania: {source.configuration.groups[0].code} · {source.configuration.groups[0].name}. Osoby: {source.configuration.educators.map(e => e.displayName).join(", ")}. Reguły i daty bieżącego projektu pozostaną bez zmian.</p>
      <button type="button" className="button button--secondary" disabled={busy} onClick={merge}>Dołącz dane grupy z pliku</button></div>}
    {message && <p role="status">{message}</p>}
  </section>;
}
