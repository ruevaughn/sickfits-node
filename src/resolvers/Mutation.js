const { randomBytes } = require("crypto");
const bcrypt = require("bcryptjs");
const { generateToken, hashPassword } = require("../../utils/auth");
const { YEAR_IN_SECONDS, HOUR_IN_SECONDS } = require("../../utils/constants");
const { promisify } = require("util");

const Mutations = {
  async createItem(parent, args, ctx, info) {
    // TODO: Check if they are logged in

    const item = await ctx.db.mutation.createItem(
      {
        data: {
          ...args
        }
      },
      info
    );
    return item;
  },

  async updateItem(parent, args, ctx, info) {
    const updates = { ...args };
    delete updates.id;
    // Because we're returning this promise based function, it will wait the update to pass.
    return ctx.db.mutation.updateItem(
      {
        data: updates,
        where: {
          id: args.id
        }
      },
      info
    );
  },

  async deleteItem(parent, args, ctx, info) {
    const where = { id: args.id };
    const item = ctx.db.query.item(
      { where },
      `{
      id
      title
    }`
    );
    // Find the Item
    // Check if correct permissions to perform action
    // Delete it
    return await ctx.db.mutation.deleteItem({ where }, info);
  },

  async signUp(parent, args, ctx, info) {
    args.email = args.email.toLowerCase();
    const password = hashPassword(args.password);
    const user = await ctx.db.mutation.createUser(
      {
        data: {
          ...args,
          password,
          permissions: { set: ["USER"] }
        }
      },
      info
    );
    // Create JWT
    const token = generateToken(user.id);
    // We set the JWT as a cookie on the response
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: YEAR_IN_SECONDS
    });
    return user;
  },

  async signIn(parent, { email, password }, ctx, info) {
    // 1. check if there is a user with that email
    const user = await ctx.db.query.user({ where: { email } });
    if (!user) {
      throw new Error(`No such user found for email ${email}`);
    }

    // 2. check if the password matches
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new Error("Invalid password");
    }

    // 3. generate the JWT token
    const token = generateToken(user.id);

    // 4. set the cookie with the token
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: YEAR_IN_SECONDS
    });

    // 5. Return the user
    return user;
  },

  signOut(parent, data, ctx, info) {
    ctx.response.clearCookie("token");
    return { message: "You have been successfully logged out" };
  },

  async requestReset(parent, { email }, ctx, info) {
    // 1. check if this is a real user
    const user = await ctx.db.query.user({ where: { email } });
    if (!user) {
      throw new Error(`No user found for email: ${email}`);
    }
    // 2. set a reset token and expiry
    const randomByesPromisified = promisify(randomBytes);
    const resetToken = (await randomByesPromisified(20)).toString("hex");
    const resetTokenExpiry = Date.now() + HOUR_IN_SECONDS;
    await ctx.db.mutation.updateUser({
      where: { email },
      data: {
        resetToken,
        resetTokenExpiry
      }
    });
    return { message: "Password reset successfully initiated" };

    // 3. Email that reset token
  },

  async resetPassword(parent, { resetToken, password, confirmPassword }, ctx, info) {
    // 1. Check if the passwords match
    if (password !== confirmPassword) {
      throw new Error("Passwords do not match");
    }

    // 2. Check if it's a legit reset token
    // 3. Check if it's expired
    const [user] = await ctx.db.query.users({
      where: {
        resetToken,
        resetTokenExpiry_gte: Date.now() - HOUR_IN_SECONDS
      }
    });

    if (!user) {
      throw new Error("Invalid Reset Token");
    }

    // 4. Hash their new password
    const hashedPassword = await hashPassword(password);

    // 5. Save the new password to the user and remove token and expiry
    const updatedUser = await ctx.db.mutation.updateUser({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });
    // 6. Generate JWT
    const token = generateToken(updatedUser.id);
    // 7. Set the JWT cookie
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: YEAR_IN_SECONDS
    });

    // 8. Return the new user
    return user;
  }
};

module.exports = Mutations;
