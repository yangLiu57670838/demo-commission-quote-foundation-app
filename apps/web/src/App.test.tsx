import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("App", () => {
  it("shows a blank commission quote page", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Commission quotes" }),
    ).toBeInTheDocument();
  });
});
