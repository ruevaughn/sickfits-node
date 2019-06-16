const jwt = require("jsonwebtoken");

const generateToken = userId => {
  return jwt.sign({ userId }, process.env.APP_SECRET);
};

module.exports = { generateToken };
