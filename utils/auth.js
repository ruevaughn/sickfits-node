const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const generateToken = userId => {
  return jwt.sign({ userId }, process.env.APP_SECRET);
};

const hashPassword = async password => {
  return bcrypt.hash(password, 10);
};

const isLoggedIn = req => {
  return req.userId ? true : false;
};

module.exports = {
  generateToken,
  hashPassword,
  isLoggedIn
};
