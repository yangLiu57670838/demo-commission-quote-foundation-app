import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { expressMiddleware } from "@as-integrations/express5";
import { quoteRequestSchema, type QuoteResponse } from "@commission-quote/contracts";
import cors from "cors";
import express from "express";
import { GraphQLError, type GraphQLFormattedError } from "graphql";
import http from "node:http";
import type { BffConfig } from "./config";
import { QUOTES_DISABLED_MESSAGE, logQuote, type QuoteLog } from "./quoteLog";
import { startTrace } from "./trace";
import {
  QUOTE_UNAVAILABLE_MESSAGE,
  VendorCallError,
  publicErrorMessage,
  requestCommissionQuote,
} from "./vendorClient";

const typeDefs = `#graphql
  type Query {
    health: String!
  }

  type Quote {
    quoteId: String!
    commissionRate: String!
    totalCommission: String!
  }

  input QuoteInput {
    loanAmount: String!
    loanTermInMonths: Int!
    riskBand: String!
  }

  type Mutation {
    generateCommissionQuote(input: QuoteInput!): Quote!
  }
`;

// just return the first issue message, but its ok since its a safe guard for the frontend, UI already use zod to validate the input
function validationMessage(issues: { message: string }[]): string {
  const issue = issues[0];
  if (issue === undefined || issue.message.length === 0) {
    return "Check the loan details and try again.";
  }
  return issue.message;
}

export async function createGraphqlServer(config: BffConfig) {
  const app = express();
  const httpServer = http.createServer(app);
  const server = new ApolloServer({
    typeDefs,
    resolvers: {
      Query: {
        health: () => "ok",
      },
      Mutation: {
        generateCommissionQuote: async (
          _parent: unknown,
          args: { input: unknown },
          context: { traceparent?: string },
        ): Promise<QuoteResponse> => {
          const trace = startTrace(context.traceparent);
          const secrets = [config.vendorApiKey, config.vendorApiUrl];
          const log = (event: Pick<QuoteLog, "level" | "outcome" | "quoteId" | "reason">) => {
            logQuote({ ...trace, ...event }, secrets);
          };
          log({ level: "info", outcome: "received" });
          if (!config.quotesEnabled) {
            log({ level: "warn", outcome: "disabled" });
            throw new GraphQLError(QUOTES_DISABLED_MESSAGE);
          }

          const parsed = quoteRequestSchema.safeParse(args.input);
          if (!parsed.success) {
            log({
              level: "warn",
              outcome: "invalid",
              reason: validationMessage(parsed.error.issues),
            });
            throw new GraphQLError(validationMessage(parsed.error.issues));
          }

          log({ level: "info", outcome: "vendor" });
          try {
            const quote = await requestCommissionQuote(config, parsed.data);
            log({ level: "info", outcome: "quoted", quoteId: quote.quoteId });
            return quote;
          } catch (error) {
            log({
              level: "error",
              outcome: "failed",
              reason: error instanceof VendorCallError ? error.kind : "unexpected",
            });
            if (error instanceof VendorCallError) {
              throw new GraphQLError(error.message);
            }
            throw new GraphQLError(QUOTE_UNAVAILABLE_MESSAGE);
          }
        },
      },
    },
    includeStacktraceInErrorResponses: false,
    formatError: (formatted: GraphQLFormattedError): GraphQLFormattedError => ({
      message: publicErrorMessage(formatted.message, config),
    }),
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await server.start();

  app.use(
    "/graphql",
    cors({ origin: "http://localhost:5173" }),
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => ({ traceparent: req.header("traceparent") }),
    }),
  );

  return httpServer;
}
