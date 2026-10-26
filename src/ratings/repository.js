const { PrismaClient } = require("@prisma/client");

class RatingResourceNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "RatingResourceNotFoundError";
  }
}

function createRatingsRepository(prisma = new PrismaClient()) {
  async function requireBook(bookId) {
    const book = await prisma.book.findUnique({ where: { id: bookId }, select: { id: true } });
    if (!book) throw new RatingResourceNotFoundError("Book not found.");
  }

  async function createRecord(delegate, data) {
    await requireBook(data.bookId);
    const user = await prisma.user.findUnique({ where: { id: data.userId }, select: { id: true } });
    if (!user) throw new RatingResourceNotFoundError("User not found.");

    try {
      return await delegate.create({ data });
    } catch (error) {
      // A referenced row can be deleted between the checks and the insert.
      if (error.code === "P2003") {
        throw new RatingResourceNotFoundError("Book or user not found.");
      }
      throw error;
    }
  }

  return {
    addRating(data) {
      return createRecord(prisma.rating, data);
    },

    async getAverageRating(bookId) {
      await requireBook(bookId);
      const result = await prisma.rating.aggregate({ where: { bookId }, _avg: { rating: true } });
      return result._avg.rating;
    },

    addComment(data) {
      return createRecord(prisma.comment, data);
    },

    async getComments(bookId) {
      await requireBook(bookId);
      return prisma.comment.findMany({
        where: { bookId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, bookId: true, userId: true, comment: true, createdAt: true },
      });
    },
  };
}

module.exports = { createRatingsRepository, RatingResourceNotFoundError };
