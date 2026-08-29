import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HashFocus } from "../components/HashFocus";

describe("przejście do miejsca naprawy", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("po kliknięciu przewija, podświetla i ustawia kursor w polu", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/podsumowanie"]}>
        <HashFocus />
        <Routes>
          <Route
            path="/podsumowanie"
            element={
              <Link to="/konfiguracja#data-poczatku-cyklu">
                Przejdź do daty początku
              </Link>
            }
          />
          <Route
            path="/konfiguracja"
            element={
              <label id="data-poczatku-cyklu">
                Początek cyklu
                <input aria-label="Początek cyklu" type="date" />
              </label>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("link", { name: "Przejdź do daty początku" }),
    );

    const input = await screen.findByLabelText("Początek cyklu");
    const target = input.closest("label");
    await waitFor(() => expect(input).toHaveFocus());
    expect(target).toHaveClass("repair-target");
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
  });
});
