import { useEffect, useState } from "react";
import { createScheduleDocxFile } from "../scheduleDocx";
import type { GenerateResponse, ScheduleConfiguration } from "../types";

interface Props {
  configuration: ScheduleConfiguration;
  generation: GenerateResponse;
}

interface PreparedWord extends Props {
  file: File;
  url: string;
}

export function WordExport({ configuration, generation }: Props) {
  const [prepared, setPrepared] = useState<PreparedWord | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let active = true;
    let url: string | undefined;
    setPrepared(null);
    setError("");
    setNotice("");
    // Word is bundled with the app, so export never needs a late module download.
    void Promise.resolve().then(async () => {
      if (!active) return;
      const file = await createScheduleDocxFile(configuration, generation);
      if (!active) return;
      url = URL.createObjectURL(file);
      setPrepared({ file, url, configuration, generation });
    }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : "Nieznany błąd przygotowania pliku.");
    });
    return () => {
      active = false;
      // A download may still be reading this URL when the user changes pages.
      if (url) {
        const releasedUrl = url;
        window.setTimeout(() => URL.revokeObjectURL(releasedUrl), 60_000);
      }
    };
  }, [configuration, generation, attempt]);

  // Never offer the previous group's or previous generation's document.
  const ready = prepared?.configuration === configuration && prepared.generation === generation
    ? prepared : null;
  let canShare = false;
  try {
    canShare = Boolean(ready && typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" && navigator.canShare({ files: [ready.file] }));
  } catch {
    // Some embedded browsers expose the API but reject file capability checks.
  }

  const share = async () => {
    if (!ready) return;
    setSharing(true);
    setNotice("");
    try {
      await navigator.share({ files: [ready.file], title: "Harmonogram pracy" });
      setNotice("Plik przekazano do wybranej aplikacji.");
    } catch (caught) {
      setNotice(typeof caught === "object" && caught !== null && "name" in caught && caught.name === "AbortError"
        ? "Udostępnianie anulowano. Nadal możesz pobrać Word poniżej."
        : "Udostępnianie nie jest dostępne. Użyj przycisku Pobierz Word (.docx).");
    } finally {
      setSharing(false);
    }
  };

  return (
    <section className="next-step-card" aria-label="Dokument Word">
      <div>
        <h2>Word — cały plan ({configuration.planningHorizonWeeks} {configuration.planningHorizonWeeks === 1 ? "tydzień" : configuration.planningHorizonWeeks < 5 ? "tygodnie" : "tygodni"})</h2>
        <p aria-live="polite">
          {error
            ? "Nie udało się przygotować Worda. Plan jest zachowany. Spróbuj ponownie; jeśli problem wraca, odśwież aplikację i ponów pobranie."
            : ready
              ? notice || `Dokument jest gotowy. Kliknij Pobierz Word (.docx).${canShare ? " Możesz też wybrać Udostępnij plik." : ""}`
              : "Przygotowuję edytowalny dokument z gotowego planu…"}
        </p>
        {ready && <small>{ready.file.name} · Jeśli plik się nie pojawił, sprawdź Pobrane w przeglądarce lub kliknij ponownie. Nie trzeba generować planu od nowa.</small>}
        {error && <details><summary>Szczegóły błędu pobierania</summary><p>{error}</p></details>}
      </div>
      <div className="button-row">
        {ready ? (
          <a className="button button--primary" href={ready.url} download={ready.file.name}
            onClick={() => setNotice("Przekazano plik do pobrania. Znajdziesz go w Pobranych przeglądarki lub w wybranym folderze.")}>
            Pobierz Word (.docx)
          </a>
        ) : (
          <button className="button button--primary" type="button" disabled={!error}
            onClick={() => setAttempt(value => value + 1)}>
            {error ? "Ponów przygotowanie Worda" : "Przygotowuję Word…"}
          </button>
        )}
        {canShare && <button className="button button--secondary" type="button" disabled={sharing}
          onClick={() => void share()}>{sharing ? "Udostępniam…" : "Udostępnij plik"}</button>}
      </div>
    </section>
  );
}
