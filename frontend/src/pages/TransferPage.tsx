import { SectionTiles } from "../components/SectionTiles";
import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState, PageHeader } from "../components/UI";
import { migrateConfiguration, useAppState } from "../state/AppState";
import {
  BEFORE_IMPORT_STORAGE_KEY,
  MAX_TRANSFER_FILE_BYTES,
  createProjectTransferPackage,
  isTransferredGenerationCompatible,
  parseDeviceTransferPackage,
  serializeDeviceTransferPackage,
  transferFileName,
} from "../transfer";
import type {
  GenerateResponse,
  InputReport,
  ScheduleConfiguration,
} from "../types";

interface ImportPreview {
  configuration: ScheduleConfiguration;
  inputReport: InputReport | null;
  generation: GenerateResponse | null;
  planDiscarded: boolean;
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error ?? new Error("Nie udało się odczytać pliku."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsText(file);
  });
}

export function TransferPage() {
  const navigate = useNavigate();
  const {
    configuration,
    inputReport,
    generation,
    importProject,
  } = useAppState();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const createFile = () => {
    if (!configuration) return null;
    const transferPackage = createProjectTransferPackage(
      configuration,
      inputReport,
      generation,
    );
    return new File(
      [serializeDeviceTransferPackage(transferPackage)],
      transferFileName(configuration),
      { type: "application/json" },
    );
  };

  const sharePackage = async () => {
    const file = createFile();
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const canShareFiles =
        typeof navigator.share === "function" &&
        (typeof navigator.canShare !== "function" ||
          navigator.canShare({ files: [file] }));
      if (canShareFiles) {
        await navigator.share({
          files: [file],
          title: "Pełny projekt Harmonogramu",
          text: "Prywatny plik projektu do wczytania w aplikacji Harmonogram na dowolnym urządzeniu.",
        });
        setMessage("Plik projektu został przekazany do wybranej aplikacji.");
      } else {
        downloadFile(file);
        setMessage(
          "Plik projektu został pobrany. Przenieś go na drugie urządzenie wybraną bezpieczną metodą.",
        );
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setMessage("Udostępnianie anulowano. Dane pozostały na tym urządzeniu.");
      } else {
        downloadFile(file);
        setMessage("Nie udało się otworzyć udostępniania, dlatego plik projektu został pobrany.");
      }
    } finally {
      setBusy(false);
    }
  };

  const downloadPackage = () => {
    const file = createFile();
    if (!file) return;
    downloadFile(file);
    setMessage("Plik projektu został pobrany. Dane w aplikacji nie zostały zmienione.");
  };

  const selectPackage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPreview(null);
    setMessage("");
    try {
      if (file.size > MAX_TRANSFER_FILE_BYTES) {
        throw new Error("Pakiet jest zbyt duży. Maksymalny rozmiar to 5 MB.");
      }
      const transferPackage = parseDeviceTransferPackage(await readFileText(file));
      const importedConfiguration = migrateConfiguration(
        transferPackage.configuration,
      );
      const importedGeneration = isTransferredGenerationCompatible(
        importedConfiguration,
        transferPackage.generation,
      )
        ? transferPackage.generation
        : null;
      setPreview({
        configuration: importedConfiguration,
        inputReport: transferPackage.inputReport,
        generation: importedGeneration,
        planDiscarded:
          transferPackage.generation !== null && importedGeneration === null,
      });
      setMessage("Plik projektu sprawdzony. Potwierdź dane przed wczytaniem.");
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : "Nie udało się odczytać pliku projektu.",
      );
    }
  };

  const importPackage = () => {
    if (!preview) return;
    if (
      configuration &&
      !window.confirm(
        "Na tym urządzeniu jest już projekt. Zostanie zachowana jego pełna kopia bezpieczeństwa, a następnie zostanie wczytany wybrany plik. Kontynuować?",
      )
    ) {
      return;
    }
    try {
      if (configuration) {
        localStorage.setItem(
          BEFORE_IMPORT_STORAGE_KEY,
          JSON.stringify({
            configuration,
            inputReport,
            generation,
            savedAt: new Date().toISOString(),
          }),
        );
      }
      importProject(
        preview.configuration,
        preview.inputReport,
        preview.generation,
      );
      setMessage(
        preview.generation
          ? "Pełny projekt wraz z gotowym planem został wczytany na tym urządzeniu."
          : "Dane projektu zostały wczytane. Uruchom generator, aby utworzyć plan.",
      );
      navigate(preview.generation ? "/harmonogram" : "/podsumowanie");
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : "Nie udało się wczytać pliku projektu.",
      );
    }
  };

  const previewGroup = preview?.configuration.groups.find(
    (item) => item.id === preview.configuration.activeGroupId,
  );
  const previewMemberIds = new Set(
    preview?.configuration.groupMemberships
      .filter(
        (item) =>
          item.active && item.groupId === preview.configuration.activeGroupId,
      )
      .map((item) => item.educatorId) ?? [],
  );
  const previewEducators =
    preview?.configuration.educators.filter((item) =>
      previewMemberIds.has(item.id),
    ) ?? [];

  return (
    <SectionTiles>
      <PageHeader
        eyebrow="PRYWATNY PLIK PROJEKTU"
        title="Eksport i import projektu"
        description="Zapisz wszystkie dane oraz gotowy, sprawdzony plan do jednego pliku i wczytaj go na telefonie albo komputerze. Plik nie jest wysyłany do GitHuba."
      />

      <div className="transfer-steps">
        <section className="section-block transfer-step">
          <span className="transfer-step__number">1</span>
          <div className="section-heading">
            <div>
              <span className="eyebrow">NA URZĄDZENIU Z DANYMI</span>
              <h2>Zapisz pełny projekt</h2>
            </div>
          </div>
          {configuration ? (
            <>
              <p>
                Plik obejmuje wszystkie grupy, wychowawców, wymiary godzin,
                nocki, dostępności, plany pobytu, weekendy i reguły
                {isTransferredGenerationCompatible(configuration, generation)
                  ? ", a także gotowy, sprawdzony harmonogram."
                  : ". Gotowy harmonogram zostanie dołączony po jego wygenerowaniu."}
              </p>
              <div className="transfer-actions">
                <button
                  className="button button--primary"
                  type="button"
                  disabled={busy}
                  onClick={() => void sharePackage()}
                >
                  Udostępnij plik projektu
                </button>
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={busy}
                  onClick={downloadPackage}
                >
                  Pobierz plik projektu
                </button>
              </div>
              <small>
                Plik zawiera dane osobowe. Przekaż go wyłącznie zaufanej osobie
                albo na własne urządzenie i usuń z komunikatora lub poczty po
                wczytaniu.
              </small>
            </>
          ) : (
            <EmptyState>
              Na tym urządzeniu nie ma projektu do zapisania. Wczytaj istniejący
              plik projektu albo najpierw utwórz konfigurację.
            </EmptyState>
          )}
        </section>

        <section className="section-block transfer-step">
          <span className="transfer-step__number">2</span>
          <div className="section-heading">
            <div>
              <span className="eyebrow">NA URZĄDZENIU DOCELOWYM</span>
              <h2>Wczytaj projekt z pliku</h2>
            </div>
          </div>
          <p>
            Wskaż plik kończący się nazwą <strong>.harmonogram.json</strong> na
            telefonie lub komputerze.
            Najpierw zobaczysz podgląd — nic nie zostanie zapisane bez potwierdzenia.
          </p>
          <label className="button button--secondary transfer-file-button">
            Wybierz plik projektu
            <input
              type="file"
              accept=".json,.harmonogram.json,application/json"
              onChange={(event) => void selectPackage(event)}
            />
          </label>

          {preview && (
            <article className="transfer-preview" aria-label="Podgląd pakietu">
              <span className="eyebrow">SPRAWDZONY PAKIET</span>
              <h3>
                {previewGroup?.code} · {previewGroup?.name}
              </h3>
              <dl>
                <div><dt>Klasa</dt><dd>{previewGroup?.classLabel || "Nie podano"}</dd></div>
                <div><dt>Wychowawcy</dt><dd>{previewEducators.length}</dd></div>
                <div><dt>Tygodnie</dt><dd>{preview.configuration.planningHorizonWeeks}</dd></div>
                <div><dt>Początek</dt><dd>{preview.configuration.cycleStartDate}</dd></div>
                <div><dt>Gotowy plan</dt><dd>{preview.generation ? "Tak — zostanie wczytany" : "Nie — trzeba wygenerować"}</dd></div>
              </dl>
              {preview.planDiscarded && (
                <p className="form-message" role="alert">
                  Plan zapisany w pliku pochodzi z niezgodnej albo starszej
                  kontroli. Dane wejściowe można bezpiecznie wczytać, ale plan
                  trzeba wygenerować ponownie.
                </p>
              )}
              <ul>
                {previewEducators.map((educator) => (
                  <li key={educator.id}>{educator.displayName}</li>
                ))}
              </ul>
              <button
                className="button button--primary"
                type="button"
                onClick={importPackage}
              >
                Wczytaj projekt na tym urządzeniu
              </button>
            </article>
          )}
        </section>
      </div>

      {message && (
        <p className="form-message transfer-message" role="status">
          {message}
        </p>
      )}
    </SectionTiles>
  );
}
