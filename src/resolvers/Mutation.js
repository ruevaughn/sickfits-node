const { randomBytes } = require("crypto");
const bcrypt = require("bcryptjs");
const { generateToken, hashPassword } = require("../../utils/auth");
const { YEAR_IN_SECONDS, HOUR_IN_SECONDS } = require("../../utils/constants");
const { promisify } = require("util");
const { transport, makeANiceEmail } = require("../../mail");
const { hasPermission } = require("../..//utils/permissions");

const Mutations = {
  async createItem(parent, args, ctx, info) {
    // TODO: Check if they are logged in
    // Logged in means that there is a valid toke nset?
    if (!ctx.request.userId) {
      throw new Error("You must be logged in to perform this action.");
    }

    const item = await ctx.db.mutation.createItem(
      {
        data: {
          user: {
            connect: {
              id: ctx.request.userId
            }
          },
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
    const item = await ctx.db.query.item(
      { where },
      `{
      id
      title
      user {
        id
      }
    }`
    );
    // Find the Item
    // Check if correct permissions to perform action
    const ownsItem = item.user.id === ctx.request.userId;
    const hasPermissions = ctx.request.currentUser.permissions.some(permission =>
      ["ADMIN", "ITEMDELETE"].includes(permission)
    );
    if (!ownsItem && !hasPermissions) {
      throw new Error("You do not have permissions to delete this item");
    }
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

    // 6. Return the user
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

    // 3. Email that reset token
    const mailRes = await transport.sendMail({
      from: "chase@chasejensen.com",
      to: user.email,
      html: makeANiceEmail(`Your password reset Link is here: \n\n
      <a href="${process.env.FRONTEND_URL}/reset?resetToken=${resetToken}">
      Click Here to Reset</a>
      `)
    });

    return { message: "Password reset successfully initiated" };
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
  },

  async updatePermissions(parent, args, ctx, info) {
    // 1. Check if they are logged in
    if (!ctx.request.userId) {
      throw new Error("You need to be logged in");
    }
    // 2. Query the current user
    const currentUser = await ctx.db.query.user(
      {
        where: {
          id: ctx.request.userId
        },
        info
      },
      `{ id, permissions, email, name}`
    );
    // 3. Check if the user has permissions
    hasPermission(currentUser, ["ADMIN", "PERMISSIONUPDATE"]);
    // 4. Update the permissions
    return ctx.db.mutation.updateUser(
      {
        data: {
          permissions: {
            set: args.permissions
          }
        },
        where: {
          id: args.userId
        }
      },
      info
    );
  },

  async addToCart(parent, args, ctx, info) {
    // 1. Ensure signed in
    const { userId } = ctx.request;
    if (!userId) {
      throw new Error("You must be signed in");
    }
    // 2. Query for the users current cart
    const [existingCartItem] = await ctx.db.query.cartItems({
      where: {
        user: { id: userId },
        item: { id: args.id }
      }
    });
    // 3. Check if that item is already in that cart. Increment by one if so
    if (existingCartItem) {
      console.log('This item is already in their cart."');
      return ctx.db.mutation.updateCartItem({
        where: {
          id: existingCartItem.id
        },
        data: {
          quantity: existingCartItem.quantity + 1
        },
        info
      });
    }
    // 4. If it's not, create a new cartItem for that user.
    return ctx.db.mutation.createCartItem(
      {
        data: {
          user: {
            connect: { id: userId }
          },
          item: {
            connect: { id: args.id }
          }
        }
      },
      info
    );
  }
};

module.exports = Mutations;
