import { useNavigate } from "react-router-dom";
import { DemoNotice, PageHeader, StatusBadge } from "../components/UI";
import { useAppState } from "../state/AppState";

export function StartPage() {
  const navigate = useNavigate();
  const { configuration, loadDemo, startNew, busy } = useAppState();

  const begin = async (kind: "new" | "demo") => {
    const value = kind === "demo" ? await loadDemo() : await startNew();
    if (value) navigate("/konfiguracja");
  };

  return (
    <>
      <PageHeader
        eyebrow="GENERATOR HARMONOGRAMU"
        title="Sześć tygodni. Trzy osoby. Bez zgadywania."
        description="Skonfiguruj zapotrzebowanie, zatwierdzone weekendy i ograniczenia. Aplikacja wygeneruje wyłącznie harmonogram zgodny ze wszystkimi regułami krytycznymi."
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
            Wczytaj wykonalny cykl A–B–C z sześcioma weekendami, dniem
            specjalnym i jawnym profilem testowym.
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
              <small>Grupa</small>
              <strong>{configuration.groupName}</strong>
            </div>
            <div className="metric">
              <small>Początek cyklu</small>
              <strong>{configuration.cycleStartDate}</strong>
            </div>
            <div className="metric">
              <small>Wychowawcy</small>
              <strong>{configuration.educators.length} / 3</strong>
            </div>
            <div className="metric">
              <small>Profil prawny</small>
              <StatusBadge value={configuration.legalRules.verificationStatus} />
            </div>
          </div>
        </section>
      )}
      <DemoNotice />
    </>
  );
}
