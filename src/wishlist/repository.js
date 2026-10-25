const { PrismaClient } = require("@prisma/client");

function createWishlistRepository(prisma = new PrismaClient()) {
  const toItem = ({ bookId, addedAt }) => ({ bookId, addedAt: addedAt.toISOString() });

  return {
    async addBook({ userId, bookId }) {
      try {
        const created = await prisma.wishlistItem.create({ data: { userId, bookId } });
        return toItem(created);
      } catch (err) {
        if (err.code === "P2002") return null;
        if (err.code === "P2003") {
          return err.meta?.constraint?.includes("userId") ? "user-not-found" : "book-not-found";
        }
        throw err;
      }
    },

    async removeBook({ userId, bookId }) {
      try {
        await prisma.wishlistItem.delete({
          where: { userId_bookId: { userId, bookId } },
        });
        return true;
      } catch (err) {
        if (err.code === "P2025") return false;
        throw err;
      }
    },

    async listBooks(userId) {
      const items = await prisma.wishlistItem.findMany({
        where: { userId },
        orderBy: { addedAt: "asc" },
      });
      return items.map(toItem);
    },
  };
}

module.exports = { createWishlistRepository };
