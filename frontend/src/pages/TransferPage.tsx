import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getApiBaseUrl, saveApiBaseUrl } from "../api";
import { EmptyState, PageHeader } from "../components/UI";
import { migrateConfiguration, useAppState } from "../state/AppState";
import {
  BEFORE_IMPORT_STORAGE_KEY,
  MAX_TRANSFER_FILE_BYTES,
  createDeviceTransferPackage,
  parseDeviceTransferPackage,
  serializeDeviceTransferPackage,
  transferFileName,
  type DeviceTransferPackage,
} from "../transfer";
import type { ScheduleConfiguration } from "../types";

interface ImportPreview {
  transferPackage: DeviceTransferPackage;
  configuration: ScheduleConfiguration;
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function TransferPage() {
  const navigate = useNavigate();
  const { configuration, setConfiguration } = useAppState();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const createFile = () => {
    if (!configuration) return null;
    const transferPackage = createDeviceTransferPackage(
      configuration,
      getApiBaseUrl(),
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
          title: "Pakiet danych Harmonogramu",
          text: "Prywatny pakiet do wczytania w aplikacji Harmonogram na drugim urządzeniu.",
        });
        setMessage("Pakiet został przekazany do wybranej aplikacji.");
      } else {
        downloadFile(file);
        setMessage(
          "Pakiet został pobrany. Przekaż go na telefon przez wybraną przez Ciebie bezpieczną metodę.",
        );
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setMessage("Udostępnianie anulowano. Dane pozostały na tym urządzeniu.");
      } else {
        downloadFile(file);
        setMessage("Nie udało się otworzyć udostępniania, dlatego pakiet został pobrany.");
      }
    } finally {
      setBusy(false);
    }
  };

  const downloadPackage = () => {
    const file = createFile();
    if (!file) return;
    downloadFile(file);
    setMessage("Pakiet został pobrany. Dane w aplikacji na komputerze nie zostały zmienione.");
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
      const transferPackage = parseDeviceTransferPackage(await file.text());
      const importedConfiguration = migrateConfiguration(
        transferPackage.configuration,
      );
      setPreview({
        transferPackage,
        configuration: importedConfiguration,
      });
      setMessage("Pakiet sprawdzony. Potwierdź dane przed wczytaniem.");
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : "Nie udało się odczytać pakietu.",
      );
    }
  };

  const importPackage = () => {
    if (!preview) return;
    if (
      configuration &&
      !window.confirm(
        "Na tym urządzeniu jest już konfiguracja. Zostanie zachowana kopia bezpieczeństwa, a następnie zastąpiona wybranym pakietem. Kontynuować?",
      )
    ) {
      return;
    }
    try {
      if (configuration) {
        localStorage.setItem(
          BEFORE_IMPORT_STORAGE_KEY,
          JSON.stringify(configuration),
        );
      }
      saveApiBaseUrl(preview.transferPackage.apiBaseUrl);
      setConfiguration(preview.configuration);
      setMessage("Dane zostały wczytane na tym urządzeniu.");
      navigate("/podsumowanie");
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : "Nie udało się wczytać pakietu.",
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
    <>
      <PageHeader
        eyebrow="PRYWATNE PRZENOSZENIE DANYCH"
        title="Przenieś plan na telefon"
        description="Program i dane instalują się osobno. Ten ekran kopiuje pełną konfigurację bez wysyłania nazwisk ani grafiku do GitHuba lub backendu."
      />

      <div className="transfer-steps">
        <section className="section-block transfer-step">
          <span className="transfer-step__number">1</span>
          <div className="section-heading">
            <div>
              <span className="eyebrow">NA KOMPUTERZE Z DANYMI</span>
              <h2>Utwórz prywatny pakiet</h2>
            </div>
          </div>
          {configuration ? (
            <>
              <p>
                Pakiet obejmuje wszystkie grupy, wychowawców, wymiary godzin,
                nocki, dostępności, plany pobytu, weekendy i reguły.
              </p>
              <div className="transfer-actions">
                <button
                  className="button button--primary"
                  type="button"
                  disabled={busy}
                  onClick={() => void sharePackage()}
                >
                  Udostępnij pakiet na telefon
                </button>
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={busy}
                  onClick={downloadPackage}
                >
                  Pobierz plik zamiast udostępniania
                </button>
              </div>
              <small>
                Pakiet zawiera dane osobowe. Przekaż go wyłącznie na swój telefon
                i usuń z komunikatora lub poczty po wczytaniu.
              </small>
            </>
          ) : (
            <EmptyState>
              Na tym urządzeniu nie ma konfiguracji do wysłania. Utwórz pakiet na
              komputerze, na którym wpisano plan.
            </EmptyState>
          )}
        </section>

        <section className="section-block transfer-step">
          <span className="transfer-step__number">2</span>
          <div className="section-heading">
            <div>
              <span className="eyebrow">NA TELEFONIE</span>
              <h2>Wczytaj otrzymany pakiet</h2>
            </div>
          </div>
          <p>
            Wskaż plik kończący się nazwą <strong>.harmonogram.json</strong>.
            Najpierw zobaczysz podgląd — nic nie zostanie zapisane bez potwierdzenia.
          </p>
          <label className="button button--secondary transfer-file-button">
            Wybierz pakiet z telefonu
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
              </dl>
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
                Wczytaj te dane na telefon
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
    </>
  );
}
