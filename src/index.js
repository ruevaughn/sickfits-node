const cookieParser = require("cookie-parser");
require("dotenv").config({ path: ".env" });
const createServer = require("./createServer");
const db = require("./db");
const server = createServer();

// TODO: Use Express middleware to handle cookies (JWT)
server.express.use(cookieParser());

// TODO: Use Express middleware to populate current user

server.start(
  {
    cors: {
      credentials: true,
      origin: process.env.FRONTEND_URL
    },
    port: process.env.PORT
  },
  serverDeets => {
    console.log(`Server is now running on http://localhost:${serverDeets.port}`);
  }
);
