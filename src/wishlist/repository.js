const { PrismaClient } = require("@prisma/client");

function createWishlistRepository(prisma = new PrismaClient()) {
  const toItem = ({ bookId, addedAt }) => ({ bookId, addedAt: addedAt.toISOString() });

  return {
    async addBook({ userId, bookId }) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) return "user-not-found";

      const book = await prisma.book.findUnique({ where: { id: bookId }, select: { id: true } });
      if (!book) return "book-not-found";

      const existing = await prisma.wishlistItem.findFirst({ where: { userId, bookId }, select: { id: true } });
      if (existing) return null;

      try {
        const created = await prisma.wishlistItem.create({ data: { userId, bookId } });
        return toItem(created);
      } catch (err) {
        if (err.code === "P2003") return "book-not-found";
        if (err.code === "P2002") return null;
        throw err;
      }
    },

    async removeBook({ userId, bookId }) {
      const { count } = await prisma.wishlistItem.deleteMany({ where: { userId, bookId } });
      return count > 0;
    },

    async listBooks(userId) {
      const items = await prisma.wishlistItem.findMany({
        where: { userId },
        orderBy: [{ addedAt: "asc" }, { id: "asc" }],
      });
      return items.map(toItem);
    },
  };
}

module.exports = { createWishlistRepository };
