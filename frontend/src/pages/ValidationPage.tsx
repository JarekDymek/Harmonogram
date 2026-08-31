import {
  EmptyState,
  MessagesTable,
  PageHeader,
  StatusBadge,
} from "../components/UI";
import { useAppState } from "../state/AppState";

export function ValidationPage() {
  const { generation } = useAppState();
  const report = generation?.validationReport;
  if (!report) {
    return (
      <EmptyState title="Brak raportu walidacji">
        Raport powstanie po wygenerowaniu i niezależnym sprawdzeniu harmonogramu.
      </EmptyState>
    );
  }
  if (report.validatorVersion !== "2.0.0") return <EmptyState title="Poprzedni wynik wymaga ponownego sprawdzenia">Dane zachowano. Przejdź do Harmonogramu i uruchom generator uwzględniający obie daty nocki oraz pracę w szkole.</EmptyState>;
  return (
    <>
      <PageHeader
        eyebrow="KROK 09 · NIEZALEŻNA KONTROLA"
        title="Raport walidacji harmonogramu"
        description={`Walidator ${report.validatorVersion} ponownie obliczył zapotrzebowanie, godziny, dni, odpoczynki i wzorce weekendowe.`}
      />
      <section className="validation-summary">
        <div>
          <small>Status</small>
          <StatusBadge value={report.status} />
        </div>
        <div>
          <small>Wynik publiczny</small>
          <StatusBadge value={report.publicResult} />
        </div>
        <div>
          <small>Profil prawny</small>
          <StatusBadge value={report.legalProfileStatus} />
        </div>
        <div>
          <small>Wersja profilu</small>
          <strong>{report.legalProfileVersion}</strong>
        </div>
      </section>
      {report.demonstrationUseProhibitedNotice && (
        <div className="legal-warning" role="alert">
          <strong>Zakaz użycia produkcyjnego</strong>
          <p>{report.demonstrationUseProhibitedNotice}</p>
        </div>
      )}
      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">SZCZEGÓŁY</span>
            <h2>Błędy, ostrzeżenia i informacje</h2>
          </div>
        </div>
        <MessagesTable messages={report.messages} />
      </section>
    </>
  );
}
