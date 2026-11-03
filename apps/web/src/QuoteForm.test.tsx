import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuoteForm } from "./QuoteForm";
import { QUOTE_UNAVAILABLE_MESSAGE } from "./quoteClient";

const sampleQuote = {
  quoteId: "quote-42",
  commissionRate: "0.005",
  totalCommission: "50.00",
};

function graphqlQuote() {
  return {
    data: {
      generateCommissionQuote: sampleQuote,
    },
  };
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

function deferredResponse() {
  let resolveResponse: (response: Response) => void = () => {};
  const promise = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });
  return { promise, resolveResponse };
}

async function fillValidLoan(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("textbox", { name: "Loan amount" }), "10000");
  await user.type(screen.getByRole("textbox", { name: "Loan term in months" }), "12");
  await user.selectOptions(screen.getByRole("combobox", { name: "Risk band" }), "LOW");
}

describe("QuoteForm", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as typeof fetch;
  });

  it("shows the commission quote form", () => {
    render(<QuoteForm />);

    expect(screen.getByRole("heading", { name: "Commission quotes" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Loan amount" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Loan term in months" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Risk band" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate Quote" })).toBeEnabled();
  });

  it("shows a quote after a valid submit", async () => {
    fetchMock.mockResolvedValue(jsonResponse(graphqlQuote()));
    const user = userEvent.setup();
    render(<QuoteForm />);

    await fillValidLoan(user);
    await user.click(screen.getByRole("button", { name: "Generate Quote" }));

    expect(await screen.findByText(sampleQuote.quoteId)).toBeInTheDocument();
    expect(screen.getByText(sampleQuote.commissionRate)).toBeInTheDocument();
    expect(screen.getByText(sampleQuote.totalCommission)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const init = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body)) as {
      variables?: { input?: unknown };
    };
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/graphql");
    expect(body.variables?.input).toEqual({
      loanAmount: "10000",
      loanTermInMonths: 12,
      riskBand: "LOW",
    });
    expect(JSON.stringify(init)).not.toMatch(/api-key|VENDOR_API/i);
  });

  it("shows an amount error and does not call the server", async () => {
    const user = userEvent.setup();
    render(<QuoteForm />);

    await user.type(screen.getByRole("textbox", { name: "Loan amount" }), "0");
    await user.type(screen.getByRole("textbox", { name: "Loan term in months" }), "12");
    await user.selectOptions(screen.getByRole("combobox", { name: "Risk band" }), "LOW");
    await user.click(screen.getByRole("button", { name: "Generate Quote" }));

    const amount = screen.getByRole("textbox", { name: "Loan amount" });
    const message = screen.getByText("Loan amount must be greater than 0");
    expect(message).toBeInTheDocument();
    expect(amount).toHaveAttribute("aria-invalid", "true");
    const describedBy = amount.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const describedNodes = describedBy?.split(" ").map((id) => document.getElementById(id)) ?? [];
    expect(describedNodes.some((node) => node?.textContent === message.textContent)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows loading and then replaces it with the quote", async () => {
    const pending = deferredResponse();
    fetchMock.mockImplementation(() => pending.promise);
    const user = userEvent.setup();
    render(<QuoteForm />);

    await fillValidLoan(user);
    await user.click(screen.getByRole("button", { name: "Generate Quote" }));

    const button = screen.getByRole("button", { name: "Generate Quote" });
    expect(button).toBeDisabled();
    expect(screen.getByText("Generating quote…")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    pending.resolveResponse(jsonResponse(graphqlQuote()));

    expect(await screen.findByText(sampleQuote.quoteId)).toBeInTheDocument();
    expect(screen.queryByText("Generating quote…")).not.toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it("shows a short error instead of a quote", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        errors: [{ message: QUOTE_UNAVAILABLE_MESSAGE }],
      }),
    );
    const user = userEvent.setup();
    render(<QuoteForm />);

    await fillValidLoan(user);
    await user.click(screen.getByRole("button", { name: "Generate Quote" }));

    expect(await screen.findByText(QUOTE_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(sampleQuote.quoteId)).not.toBeInTheDocument();
    expect(screen.queryByText("Generating quote…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate Quote" })).toBeEnabled();
  });

  it("tabs through the fields and submits with Enter", async () => {
    fetchMock.mockResolvedValue(jsonResponse(graphqlQuote()));
    const user = userEvent.setup();
    render(<QuoteForm />);

    await user.tab();
    const amount = screen.getByRole("textbox", { name: "Loan amount" });
    expect(amount).toHaveFocus();
    await user.type(amount, "10000");

    await user.tab();
    const term = screen.getByRole("textbox", { name: "Loan term in months" });
    expect(term).toHaveFocus();
    await user.type(term, "12");

    await user.tab();
    const riskBand = screen.getByRole("combobox", { name: "Risk band" });
    expect(riskBand).toHaveFocus();
    await user.selectOptions(riskBand, "LOW");

    await user.tab();
    expect(screen.getByRole("button", { name: "Generate Quote" })).toHaveFocus();

    await user.click(amount);
    await user.keyboard("{Enter}");

    expect(await screen.findByText(sampleQuote.quoteId)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
