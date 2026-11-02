import { After, AfterAll, Before, BeforeAll, setDefaultTimeout } from "@cucumber/cucumber";
import { chromium, type Browser } from "@playwright/test";
import { startStack, type RunningStack } from "./servers";
import { QuoteWorld } from "./world";

// Keep a value use so the custom world is registered. A type-only import would be erased.
void QuoteWorld;

setDefaultTimeout(30_000);

let browser: Browser | undefined;
let stack: RunningStack | undefined;

BeforeAll(async () => {
  browser = await chromium.launch();
  try {
    stack = await startStack();
  } catch (error) {
    await browser.close();
    browser = undefined;
    throw error;
  }
});

Before(async function (this: QuoteWorld) {
  if (browser === undefined || stack === undefined) {
    throw new Error("The browser suite did not start");
  }
  const page = await browser.newPage();
  this.openQuote(page, stack.webUrl, { apiKey: stack.apiKey, vendorUrl: stack.vendorUrl });
});

After(async function (this: QuoteWorld) {
  await this.page?.close();
});

AfterAll(async () => {
  await browser?.close();
  await stack?.stop();
});
