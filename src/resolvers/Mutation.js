const bcrypt = require("bcryptjs");
const { generateToken } = require("../../utils/auth");
const { YEAR_IN_SECONDS } = require("../../utils/constants");

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
    const password = await bcrypt.hash(args.password, 10);
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
  }
};

module.exports = Mutations;
