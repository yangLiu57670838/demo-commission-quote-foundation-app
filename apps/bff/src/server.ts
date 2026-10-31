import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { expressMiddleware } from "@as-integrations/express5";
import cors from "cors";
import express from "express";
import http from "node:http";

const typeDefs = `#graphql
  type Query {
    health: String!
  }
`;

const resolvers = {
  Query: {
    health: () => "ok",
  },
};

export async function createGraphqlServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const server = new ApolloServer({
    typeDefs,
    resolvers,
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
