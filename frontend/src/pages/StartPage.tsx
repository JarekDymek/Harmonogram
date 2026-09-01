import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getApiBaseUrl, saveApiBaseUrl } from "../api";
import { PageHeader, StatusBadge } from "../components/UI";
import { useAppState } from "../state/AppState";

export function StartPage() {
  const navigate = useNavigate();
  const { configuration, loadDemo, startNew, busy } = useAppState();
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl);
  const [apiStatus, setApiStatus] = useState<
    "idle" | "checking" | "online" | "offline"
  >("idle");
  const [apiMessage, setApiMessage] = useState(
    "Adres pusty oznacza backend dostępny pod tym samym adresem co aplikacja.",
  );

  const begin = async (kind: "new" | "demo") => {
    const value = kind === "demo" ? await loadDemo() : await startNew();
    if (value) navigate("/konfiguracja");
  };

  const checkApi = async () => {
    setApiStatus("checking");
    try {
      const normalized = saveApiBaseUrl(apiUrl);
      setApiUrl(normalized);
      const health = await api.health();
      setApiStatus("online");
      setApiMessage(
        `Połączono z usługą ${health.service}. Ustawienie zapisano w tej przeglądarce.`,
      );
    } catch (caught) {
      setApiStatus("offline");
      setApiMessage(
        caught instanceof Error
          ? caught.message
          : "Nie udało się sprawdzić połączenia z API.",
      );
    }
  };

  const useSameOrigin = () => {
    saveApiBaseUrl("");
    setApiUrl("");
    setApiStatus("idle");
    setApiMessage(
      "Używany będzie backend dostępny pod tym samym adresem co aplikacja.",
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="GENERATOR HARMONOGRAMU"
        title="Od jednej do ośmiu grup. Jeden wspólny harmonogram internatu."
        description="Skonfiguruj grupy, globalny zespół, zatwierdzone weekendy i ograniczenia. Aplikacja wygeneruje wyłącznie harmonogram zgodny ze wszystkimi regułami krytycznymi."
      />
      <section className="hero-grid">
        <article className="action-card action-card--primary">
          <span className="card-number">01</span>
          <h2>Nowy harmonogram</h2>
          <p>
            Rozpocznij od kompletnej struktury roboczej i zastąp dane wzorcami
            zatwierdzonymi dla placówki.
          </p>
          <button
            className="button button--light"
            type="button"
            disabled={busy}
            onClick={() => void begin("new")}
          >
            Utwórz konfigurację
          </button>
        </article>
        <article className="action-card">
          <span className="card-number">02</span>
          <h2>Dane demonstracyjne</h2>
          <p>
            Wczytaj wykonalny, tygodniowy harmonogram A–B–C w trybie
            skończonym, z jawnym profilem testowym.
          </p>
          <button
            className="button button--secondary"
            type="button"
            disabled={busy}
            onClick={() => void begin("demo")}
          >
            Otwórz demonstrację
          </button>
        </article>
      </section>

      {configuration && (
        <section className="section-block">
          <div className="section-heading">
            <div>
              <span className="eyebrow">OSTATNIA KONFIGURACJA</span>
              <h2>{configuration.projectName}</h2>
            </div>
            <button
              type="button"
              className="button button--text"
              onClick={() => navigate("/podsumowanie")}
            >
              Kontynuuj →
            </button>
          </div>
          <div className="metric-grid">
            <div className="metric">
              <small>Grupy</small>
              <strong>{configuration.groupCount} · aktywna {configuration.groupName}</strong>
            </div>
            <div className="metric">
              <small>Początek cyklu</small>
              <strong>{configuration.cycleStartDate}</strong>
            </div>
            <div className="metric">
              <small>Wychowawcy</small>
              <strong>{configuration.educators.length}</strong>
            </div>
            <div className="metric">
              <small>Horyzont</small>
              <strong>
                {configuration.planningHorizonWeeks} tyg.
              </strong>
            </div>
            <div className="metric">
              <small>Profil prawny</small>
              <StatusBadge value={configuration.legalRules.verificationStatus} />
            </div>
          </div>
        </section>
      )}
      <section className="section-block transfer-callout">
        <div>
          <span className="eyebrow">PLIK PROJEKTU · KAŻDE URZĄDZENIE</span>
          <h2>{configuration ? "Zapisz albo przenieś cały projekt" : "Masz projekt zapisany na innym urządzeniu?"}</h2>
          <p>
            Jeden prywatny plik może zawierać nazwiska, godziny, nocki,
            dostępność oraz gotowy, sprawdzony harmonogram. Ten sam plik działa
            na telefonie i komputerze.
          </p>
        </div>
        <button
          className="button button--primary"
          type="button"
          onClick={() => navigate("/urzadzenia")}
        >
          {configuration ? "Eksport i import" : "Wczytaj projekt z pliku"}
        </button>
      </section>
      <section className="section-block api-connection">
        <div className="section-heading">
          <div>
            <span className="eyebrow">POŁĄCZENIE Z GENERATOREM</span>
            <h2>Adres backendu API</h2>
          </div>
          <span className={`api-status api-status--${apiStatus}`}>
            {apiStatus === "online"
              ? "Połączono"
              : apiStatus === "checking"
                ? "Sprawdzanie…"
                : apiStatus === "offline"
                  ? "Brak połączenia"
                  : "Nie sprawdzono"}
          </span>
        </div>
        <p>
          Instalator Windows używa wbudowanego backendu. Wersja PWA z GitHub
          Pages wymaga publicznego adresu HTTPS wdrożonego API.
        </p>
        <div className="api-connection__controls">
          <label>
            <span>Adres API</span>
            <input
              type="url"
              inputMode="url"
              value={apiUrl}
              onChange={(event) => setApiUrl(event.target.value)}
              placeholder="https://twoj-backend.onrender.com"
              aria-describedby="api-connection-message"
            />
          </label>
          <button
            type="button"
            className="button button--primary"
            disabled={apiStatus === "checking"}
            onClick={() => void checkApi()}
          >
            Zapisz i sprawdź
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={useSameOrigin}
          >
            Użyj tego samego adresu
          </button>
        </div>
        <small
          id="api-connection-message"
          className={`api-connection__message api-connection__message--${apiStatus}`}
        >
          {apiMessage}
        </small>
      </section>
    </>
  );
}
