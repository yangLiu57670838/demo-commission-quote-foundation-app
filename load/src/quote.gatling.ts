import {
  atOnceUsers,
  getParameter,
  global,
  jmesPath,
  scenario,
  simulation,
  StringBody,
  substring,
  type Duration,
} from "@gatling.io/core";
import { http, status } from "@gatling.io/http";

const baseUrl = getParameter("baseUrl", "http://127.0.0.1:4000");
const users = positiveWholeNumber(getParameter("users", "50"), 50);
const apiKey = getParameter("apiKey", "");
const requestTimeout: Duration = { amount: 5, unit: "seconds" };

const quoteBody = JSON.stringify({
  query: `mutation Generate($input: QuoteInput!) {
    generateCommissionQuote(input: $input) {
      quoteId
      commissionRate
      totalCommission
    }
  }`,
  variables: {
    input: {
      loanAmount: "10000",
      loanTermInMonths: 12,
      riskBand: "LOW",
    },
  },
});

/**
 * One request per user. No pause and no retry: a repeat can mint a new quote id.
 * Run the vendor with VENDOR_FAILURE_RATE=0 so a fake fault is not counted as load.
 */
export default simulation((setUp) => {
  const httpProtocol = http
    .baseUrl(baseUrl)
    .acceptHeader("application/json")
    .contentTypeHeader("application/json")
    .disableWarmUp();

  const generateQuote = scenario("Generate commission quote").exec(
    http("generateCommissionQuote")
      .post("/graphql")
      .body(StringBody(quoteBody))
      .requestTimeout(requestTimeout)
      .check(
        status().is(200),
        jmesPath("data.generateCommissionQuote.quoteId").exists(),
        jmesPath("data.generateCommissionQuote.commissionRate").is("0.005"),
        jmesPath("data.generateCommissionQuote.totalCommission").is("50.00"),
        substring("node_modules").notExists(),
        substring("api-key").notExists(),
        ...(apiKey.length > 0 ? [substring(apiKey).notExists()] : []),
      ),
  );

  setUp(generateQuote.injectOpen(atOnceUsers(users)))
    .protocols(httpProtocol)
    .assertions(
      global().failedRequests().count().lt(1),
      global().responseTime().percentile(95).lt(3000),
    );
});

function positiveWholeNumber(value: string, fallback: number): number {
  if (!/^[1-9]\d*$/.test(value)) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}
