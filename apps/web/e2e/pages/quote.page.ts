import type { Page, Request } from "@playwright/test";
import { quoteLocators } from "../locators/quote.locators";

export type PageSecrets = {
  apiKey: string;
  vendorUrl: string;
};

export class QuotePage {
  private readonly graphqlRequests: Request[] = [];

  constructor(
    private readonly page: Page,
    private readonly baseUrl: string,
    private readonly secrets: PageSecrets,
  ) {
    this.page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/graphql") {
        this.graphqlRequests.push(request);
      }
    });
  }

  async open(): Promise<void> {
    await this.page.goto(this.baseUrl);
    await this.page.getByRole("heading", { name: quoteLocators.heading }).waitFor();
  }

  async usePhoneViewport(): Promise<void> {
    await this.page.setViewportSize({ width: 390, height: 844 });
    await this.open();
  }

  async enterLoan(amount: string, term: string, band: string): Promise<void> {
    await this.amount().fill(amount);
    await this.term().fill(term);
    await this.riskBand().selectOption(band);
  }

  async fillByKeyboard(amount: string, term: string, band: string): Promise<void> {
    await this.page.keyboard.press("Tab");
    await this.expectFocused("loan-amount");
    await this.page.keyboard.type(amount);
    await this.page.keyboard.press("Tab");
    await this.expectFocused("loan-term");
    await this.page.keyboard.type(term);
    await this.page.keyboard.press("Tab");
    await this.expectFocused("risk-band");
    await this.riskBand().selectOption(band);
    await this.page.keyboard.press("Tab");
    await this.expectFocused("submit");
  }

  async pressEnter(): Promise<void> {
    await this.page.keyboard.press("Enter");
  }

  async slowNextQuote(): Promise<void> {
    await this.page.route("**/graphql", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.continue();
    });
  }

  async generate(): Promise<void> {
    await this.generateButton().click();
  }

  async expectLoading(): Promise<void> {
    await this.page.getByText(quoteLocators.loading).waitFor({ state: "visible" });
    if (await this.generateButton().isEnabled()) {
      throw new Error("Generate Quote stayed enabled while the quote was loading");
    }
  }

  async expectQuote(rate: string, total: string): Promise<void> {
    await this.page.getByText(quoteLocators.loading).waitFor({ state: "hidden" }).catch(() => undefined);
    const quoteId = await this.valueAfter(quoteLocators.quoteId);
    const commissionRate = await this.valueAfter(quoteLocators.commissionRate);
    const totalCommission = await this.valueAfter(quoteLocators.totalCommission);
    if (quoteId.length === 0) {
      throw new Error("Quote id was empty");
    }
    if (commissionRate !== rate || totalCommission !== total) {
      throw new Error("Quote figures did not match the mock formula");
    }
  }

  async expectAmountError(): Promise<void> {
    await this.page.getByText(quoteLocators.amountError).waitFor({ state: "visible" });
    const invalid = await this.amount().getAttribute("aria-invalid");
    if (invalid !== "true") {
      throw new Error("Loan amount was not marked invalid");
    }
  }

  async expectNoGraphqlCall(): Promise<void> {
    if (this.graphqlRequests.length > 0) {
      throw new Error("The browser called the BFF");
    }
  }

  async expectNoSecrets(): Promise<void> {
    const text = await this.page.locator("body").innerText();
    if (this.secrets.apiKey.length > 0 && text.includes(this.secrets.apiKey)) {
      throw new Error("The page showed the api key");
    }
    if (text.includes(this.secrets.vendorUrl) || text.includes("x-simulate")) {
      throw new Error("The page showed the vendor URL or a simulate header");
    }
    if (text.includes("node_modules") || text.includes("\n    at ")) {
      throw new Error("The page showed a stack");
    }
    for (const request of this.graphqlRequests) {
      const headers = request.headers();
      if (headers["api-key"] !== undefined || headers["x-simulate"] !== undefined) {
        throw new Error("The browser sent a vendor header");
      }
    }
  }

  async expectNoSidewaysScroll(): Promise<void> {
    const scrolls = await this.page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    if (scrolls) {
      throw new Error("The page scrolls sideways");
    }
  }

  private amount() {
    return this.page.getByRole("textbox", { name: quoteLocators.loanAmount });
  }

  private term() {
    return this.page.getByRole("textbox", { name: quoteLocators.loanTerm });
  }

  private riskBand() {
    return this.page.getByRole("combobox", { name: quoteLocators.riskBand });
  }

  private generateButton() {
    return this.page.getByRole("button", { name: quoteLocators.generate });
  }

  private async valueAfter(label: string): Promise<string> {
    const value = this.page
      .locator("dt", { hasText: label })
      .locator("xpath=following-sibling::dd[1]");
    await value.waitFor({ state: "visible" });
    return (await value.innerText()).trim();
  }

  private async expectFocused(target: string): Promise<void> {
    const active = await this.page.evaluate(() => {
      const element = document.activeElement;
      return {
        id: element?.id ?? "",
        tag: element?.tagName ?? "",
        type: element instanceof HTMLButtonElement ? element.type : "",
      };
    });
    if (target === "submit") {
      if (active.tag !== "BUTTON" || active.type !== "submit") {
        throw new Error("Focus was not on Generate Quote");
      }
      return;
    }
    if (active.id !== target) {
      throw new Error(`Focus was on ${active.id || "nothing"}`);
    }
  }
}
