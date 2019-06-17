const { forwardTo } = require("prisma-binding");
const { isLoggedIn } = require("../../utils/auth");
const hasPermission = require("../../utils/permissions");

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
  }
};

module.exports = Query;
