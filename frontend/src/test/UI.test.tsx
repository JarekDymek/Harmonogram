import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { MessagesTable, Timeline } from "../components/UI";

describe("komponenty raportowe", () => {
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
              context: { weekNumber: 1 },
            },
          ]}
        />
      </MemoryRouter>,
    );
    const card = screen.getByRole("article");
    expect(within(card).getByText("Sprawdź wymiar godzin")).toBeVisible();
    expect(within(card).getByText("BŁĄD")).toBeVisible();
    expect(
      within(card).getByRole("link", { name: "Uzupełnij godziny" }),
    ).toHaveAttribute("href", "/wychowawcy#godziny");
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
});
