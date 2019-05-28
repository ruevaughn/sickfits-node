const { GraphQLServer } = require("graphql-yoga");
const Mutation = require("./resolvers/Mutation");
const Query = require("./resolvers/Query");
const db = require("./db.js");

function createServer() {
  return new GraphQLServer({
    typeDefs: "src/schema.graphql",
    resolvers: {
      Mutation,
      Query
    },
    resolverValidationOptions: {
      requireResolversForResolveType: false
    },
    context: req => ({ ...req, db })
  });
}

module.exports = createServer;

// Have to hit a route - ExpressJS Queries GQL Endpoint with the query / mutation
// Have to hit an action - GQL Yoga (sitting on top of Express Server / ApolloServer) - Needs a Resolver
// Have to hit the DB - GQL Yoga uses Prisma adapter to query DB. Mutation resolvers are sent to the Prisma Server and ran on there.
