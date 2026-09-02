import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { RepairGuide } from "../components/RepairGuide";
import { MessagesTable, Timeline } from "../components/UI";

describe("komponenty raportowe", () => {
  it("nie udaje planu naprawy, gdy nie ustalono przyczyny", () => {
    const message = {ruleId: "REQ-NO-GUESSING-001", severity: "ERROR" as const,
      message: "Nie ustalono konkretnego wpisu będącego przyczyną.", context: {conflictType: "COMBINED_HARD_RULES"}};
    render(<MemoryRouter><RepairGuide messages={[message]} /><MessagesTable messages={[message]} /></MemoryRouter>);
    expect(screen.queryByText("PLAN NAPRAWY KROK PO KROKU")).not.toBeInTheDocument();
    expect(screen.getByText(message.message, {selector: ".message-card__heading p"})).toBeVisible();
    expect(screen.queryByText("Miejsce do poprawy:")).not.toBeInTheDocument();
    expect(screen.getByRole("link", {name: "Przejdź do eksportu projektu"})).toHaveAttribute("href", "/urzadzenia");
  });
  it("pokazuje prostą instrukcję i link do naprawy", () => {
    render(
      <MemoryRouter>
        <MessagesTable
          messages={[
            {
              ruleId: "REQ-HOURS-001",
              severity: "ERROR",
              message: "Bilans tygodnia jest niepoprawny.",
              requiredValue: 4920,
              actualValue: 4950,
              context: {
                weekNumber: 1,
                requiredMinutes: 4920,
                assignedMinutes: 4950,
                differenceMinutes: 30,
              },
            },
          ]}
        />
      </MemoryRouter>,
    );
    const card = screen.getByRole("article");
    expect(
      within(card).getByText("W tygodniu 1 wpisano za dużo o 0,5 godz."),
    ).toBeVisible();
    expect(within(card).getByText("BŁĄD")).toBeVisible();
    expect(
      within(card).getByRole("link", { name: "Popraw tydzień 1" }),
    ).toHaveAttribute("href", "/wychowawcy#godziny-tydzien-1");
    expect(within(card).getByText(/Miejsce do poprawy:/)).toBeVisible();
    expect(within(card).getByText("REQ-HOURS-001")).toBeInTheDocument();
  });

  it("opisuje wizualny przedział także tekstem dostępnym", () => {
    render(
      <Timeline
        intervals={[
          {
            startMinute: 360,
            endMinute: 480,
            requiredStaffCount: 1,
          },
        ]}
      />,
    );
    expect(screen.getByLabelText("Wymagane przedziały opieki")).toBeVisible();
    expect(screen.getByTitle("06:00–08:00")).toBeVisible();
  });

  it("pokazuje numer pozycji weekendu przed przejściem do naprawy", () => {
    render(
      <MemoryRouter>
        <MessagesTable
          messages={[
            {
              ruleId: "REQ-WEEKEND-001",
              severity: "ERROR",
              message: "Wariant weekendowy jest niepełny.",
              context: { position: 3 },
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Pozycja weekendu: 3")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Przejdź do tego weekendu" }),
    ).toHaveAttribute("href", "/weekendy#weekend-pozycja-3");
  });

  it("prowadzi krok po kroku przez problemy i pokazuje warianty naprawy", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RepairGuide
          messages={[
            {
              ruleId: "REQ-CROSS-GROUP-REST-001",
              severity: "ERROR",
              message: "Nocka koliduje z dyżurem weekendowym.",
              context: {
                conflictType: "NIGHT_WEEKEND_REST",
                position: 1,
              },
            },
            {
              ruleId: "REQ-HOURS-001",
              severity: "ERROR",
              message: "W tygodniu 2 brakuje godzin.",
              context: {
                weekNumber: 2,
                requiredMinutes: 6000,
                assignedMinutes: 5880,
                differenceMinutes: -120,
              },
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Krok 1 z 2")).toBeVisible();
    expect(screen.getByLabelText("Proponowane sposoby naprawy")).toHaveTextContent(
      "Opcja 2",
    );
    expect(screen.getByRole("link", { name: "Zmień lub usuń nockę" })).toHaveAttribute(
      "href",
      "/wychowawcy#nocki",
    );

    await user.click(screen.getByRole("button", { name: "Następny problem" }));

    expect(screen.getByText("Krok 2 z 2")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "W tygodniu 2 brakuje 2 godz." }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Następny problem" })).toBeDisabled();
  });
});
