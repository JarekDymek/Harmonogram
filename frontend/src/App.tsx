import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { BasicPage } from "./pages/BasicPage";
import { EducatorsPage } from "./pages/EducatorsPage";
import { NoSolutionPage } from "./pages/NoSolutionPage";
import { PlansPage } from "./pages/PlansPage";
import { RulesPage } from "./pages/RulesPage";
import { SchedulePage } from "./pages/SchedulePage";
import { StartPage } from "./pages/StartPage";
import { SummaryPage } from "./pages/SummaryPage";
import { ValidationPage } from "./pages/ValidationPage";
import { WeekendsPage } from "./pages/WeekendsPage";
import { InternatPage } from "./pages/InternatPage";
import { TransferPage } from "./pages/TransferPage";
import { InstallPage } from "./pages/InstallPage";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<StartPage />} />
        <Route path="konfiguracja" element={<BasicPage />} />
        <Route path="wychowawcy" element={<EducatorsPage />} />
        <Route path="plany" element={<PlansPage />} />
        <Route path="weekendy" element={<WeekendsPage />} />
        <Route path="reguly" element={<RulesPage />} />
        <Route path="podsumowanie" element={<SummaryPage />} />
        <Route path="harmonogram" element={<SchedulePage />} />
        <Route path="internat" element={<InternatPage />} />
        <Route path="walidacja" element={<ValidationPage />} />
        <Route path="urzadzenia" element={<TransferPage />} />
        <Route path="instalacja" element={<InstallPage />} />
        <Route path="brak-rozwiazania" element={<NoSolutionPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  );
}
