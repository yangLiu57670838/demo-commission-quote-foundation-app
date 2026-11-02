import { World, setWorldConstructor, type IWorldOptions } from "@cucumber/cucumber";
import type { Page } from "@playwright/test";
import { QuotePage, type PageSecrets } from "../pages/quote.page";

export class QuoteWorld extends World {
  page!: Page;
  quote!: QuotePage;

  constructor(options: IWorldOptions) {
    super(options);
  }

  openQuote(page: Page, baseUrl: string, secrets: PageSecrets): void {
    this.page = page;
    this.quote = new QuotePage(page, baseUrl, secrets);
  }
}

setWorldConstructor(QuoteWorld);
