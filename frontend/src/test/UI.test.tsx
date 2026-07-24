import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessagesTable, Timeline } from "../components/UI";

describe("komponenty raportowe", () => {
  it("pokazuje ruleId, wymagane i faktyczne wartości", () => {
    render(
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
      />,
    );
    const row = screen.getByRole("row", { name: /REQ-HOURS-001/ });
    expect(within(row).getByText("4920 / 4950")).toBeVisible();
    expect(within(row).getByText("ERROR")).toBeVisible();
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
});
