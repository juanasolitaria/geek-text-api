const { PrismaClient } = require("@prisma/client");

// The routes only depend on these four methods, so a Prisma client can be
// swapped out for a lightweight fake in tests.
function createCartRepository(prisma = new PrismaClient()) {
  return {
    // Returns the created cart item, `null` if the book is already in the
    // cart (unique constraint), or `false` if the bookId doesn't exist
    // (foreign key constraint).
    async addBook({ userId, bookId }) {
      try {
        return await prisma.cartItem.create({ data: { userId, bookId } });
      } catch (err) {
        if (err.code === "P2002") return null;
        if (err.code === "P2003") return false;
        throw err;
      }
    },

    // Returns true if removed, false if the book wasn't in the cart.
    async removeBook({ userId, bookId }) {
      try {
        await prisma.cartItem.delete({
          where: { userId_bookId: { userId, bookId } },
        });
        return true;
      } catch (err) {
        if (err.code === "P2025") return false;
        throw err;
      }
    },

    // Returns the full Book objects currently in the user's cart.
    async listBooks(userId) {
      const items = await prisma.cartItem.findMany({
        where: { userId },
        include: { book: true },
        orderBy: { addedAt: "asc" },
      });
      return items.map((item) => item.book);
    },

    // Sums in integer cents first to avoid floating-point drift. Books
    // without a price (nullable in the Book model) count as 0.
    async getSubtotal(userId) {
      const items = await prisma.cartItem.findMany({
        where: { userId },
        include: { book: true },
      });

      const totalCents = items.reduce((sum, item) => {
        const price = item.book.price !== null ? Number(item.book.price) : 0;
        return sum + Math.round(price * 100);
      }, 0);

      return totalCents / 100;
    },
  };
}

module.exports = { createCartRepository };
