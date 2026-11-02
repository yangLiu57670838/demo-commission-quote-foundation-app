import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { expressMiddleware } from "@as-integrations/express5";
import { quoteRequestSchema, type QuoteResponse } from "@commission-quote/contracts";
import cors from "cors";
import express from "express";
import { GraphQLError, type GraphQLFormattedError } from "graphql";
import { randomUUID } from "node:crypto";
import http from "node:http";
import type { BffConfig } from "./config";
import { QUOTES_DISABLED_MESSAGE, logQuote } from "./quoteLog";
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
        ): Promise<QuoteResponse> => {
          const requestId = randomUUID();
          const secrets = [config.vendorApiKey, config.vendorApiUrl];
          if (!config.quotesEnabled) {
            logQuote({ requestId, outcome: "disabled" }, secrets);
            throw new GraphQLError(QUOTES_DISABLED_MESSAGE);
          }

          const parsed = quoteRequestSchema.safeParse(args.input);
          if (!parsed.success) {
            logQuote({ requestId, outcome: "invalid" }, secrets);
            throw new GraphQLError(validationMessage(parsed.error.issues));
          }

          try {
            const quote = await requestCommissionQuote(config, parsed.data, requestId);
            logQuote({ requestId, outcome: "quoted" }, secrets);
            return quote;
          } catch (error) {
            logQuote({ requestId, outcome: "failed" }, secrets);
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
    expressMiddleware(server),
  );

  return httpServer;
}
