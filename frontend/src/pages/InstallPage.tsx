import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/UI";
import { usePwaInstall } from "../pwa";

export function InstallPage() {
  const { canInstall, installed, install } = usePwaInstall();
  const [message, setMessage] = useState("");
  return <>
    <PageHeader eyebrow="INSTALACJA W WINDOWS" title="Harmonogram jako aplikacja — bez pliku EXE"
      description="To ta sama aplikacja PWA, instalowana przez Microsoft Edge lub Google Chrome. Nie pobierasz instalatora, skryptu ani pliku ZIP." />
    <section className="section-block">
      <h2>{installed ? "Aplikacja działa już w osobnym oknie" : "Zainstaluj w używanej przeglądarce"}</h2>
      <p>Użyj tej samej przeglądarki i profilu, w których masz zapisany projekt. Instalacja PWA nie wymaga kasowania danych. Inna przeglądarka lub inne urządzenie ma oddzielny magazyn — wtedy najpierw przenieś plik projektu.</p>
      {canInstall && <button type="button" className="button button--primary" onClick={async () => {
        try { setMessage(await install() ? "Zaakceptowano instalację. Dokończ ewentualne kroki w oknie przeglądarki." : "Instalację anulowano. Projekt pozostał bez zmian."); }
        catch { setMessage("Przeglądarka nie otworzyła instalacji. Skorzystaj z jej menu opisanego poniżej."); }
      }}>Zainstaluj Harmonogram w Windows</button>}
      {message && <p role="status">{message}</p>}
      {!installed && <ol>
        <li>Otwórz tę stronę w Edge lub Chrome na komputerze.</li>
        <li>Kliknij przycisk instalacji powyżej albo ikonę instalowania aplikacji w pasku adresu.</li>
        <li>Gdy przycisku nie ma: w Edge wybierz menu ⋯ → Aplikacje → Zainstaluj tę witrynę jako aplikację. Pozycja może znajdować się w „Więcej narzędzi”, zależnie od wersji.</li>
        <li>Potwierdź instalację w przeglądarce. Harmonogram uruchomisz potem z menu Start i możesz przypiąć go do paska zadań.</li>
      </ol>}
      <p>Ten sposób nie wymaga uruchamiania niepodpisanego instalatora EXE ani wyłączania Defendera lub SmartScreen. Nie możemy jednak zagwarantować braku ostrzeżeń lub blokad wynikających z polityki komputera służbowego.</p>
      <p><a href="https://support.microsoft.com/en-us/topic/install-manage-or-uninstall-apps-in-microsoft-edge-0c156575-a94a-45e4-a54f-3a84846f6113" target="_blank" rel="noreferrer">Instrukcja instalacji aplikacji w Microsoft Edge</a></p>
      <p>Aktualizacje będą sygnalizowane przyciskiem „Odśwież aplikację”. Generowanie planu wymaga połączenia z internetem.</p>
      <div className="button-row"><Link className="button button--secondary" to="/urzadzenia">Eksport i import projektu</Link><Link className="button button--primary" to="/">Otwórz Harmonogram</Link></div>
    </section>
  </>;
}
