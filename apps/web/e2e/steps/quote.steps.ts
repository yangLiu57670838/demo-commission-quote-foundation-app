import { Given, Then, When } from "@cucumber/cucumber";
import type { QuoteWorld } from "../support/world";

Given("I open the quote form", async function (this: QuoteWorld) {
  await this.quote.open();
});

Given("the viewport is 390 by 844", async function (this: QuoteWorld) {
  await this.quote.usePhoneViewport();
});

When(
  "I enter loan amount {string}, term {string}, and risk band {string}",
  async function (this: QuoteWorld, amount: string, term: string, band: string) {
    await this.quote.enterLoan(amount, term, band);
  },
);

When("I tab through the fields and enter a valid loan", async function (this: QuoteWorld) {
  await this.quote.fillByKeyboard("10000", "12", "LOW");
});

When("I press Enter", async function (this: QuoteWorld) {
  await this.quote.pressEnter();
});

When("the next quote response is slow", async function (this: QuoteWorld) {
  await this.quote.slowNextQuote();
});

When("I click Generate Quote", async function (this: QuoteWorld) {
  await this.quote.generate();
});

Then("I see the loading text", async function (this: QuoteWorld) {
  await this.quote.expectLoading();
});

Then("I see the quote for a 10000 loan at LOW", async function (this: QuoteWorld) {
  await this.quote.expectQuote("0.005", "50.00");
});

Then("I see the amount error beside the field", async function (this: QuoteWorld) {
  await this.quote.expectAmountError();
});

Then("the browser did not call the BFF", async function (this: QuoteWorld) {
  await this.quote.expectNoGraphqlCall();
});

Then("the page does not show the api key, a stack, or the vendor URL", async function (this: QuoteWorld) {
  await this.quote.expectNoSecrets();
});

Then("the page does not scroll sideways", async function (this: QuoteWorld) {
  await this.quote.expectNoSidewaysScroll();
});
