const { forwardTo } = require("prisma-binding");
const { isLoggedIn } = require("../../utils/auth");
const { hasPermission } = require("../../utils/permissions");

const Query = {
  items: forwardTo("db"),
  item: forwardTo("db"),
  itemsConnection: forwardTo("db"),
  me(parent, args, ctx, info) {
    // Check if there is a current user
    if (!isLoggedIn(ctx.request)) return null;

    return ctx.db.query.user(
      {
        where: { id: ctx.request.userId }
      },
      info
    );
  },
  async users(parent, args, { request, db }, info) {
    // 1. Check if they are logged in
    if (!isLoggedIn(request))
      throw new Error("You must be logged in to perform this action");

    // 2. Check if the user has the permission to query all the users
    hasPermission(request.currentUser, ["ADMIN", "USER", "PERMISSIONUPDATE"]);

    // 3. If they do, query all the users!
    // Info is going to include the graphql query which has the fields we are requesting on the front end
    return db.query.users({}, info);
  }
};

module.exports = Query;
