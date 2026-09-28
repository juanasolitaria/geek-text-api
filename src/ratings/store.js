const { randomUUID } = require("node:crypto");

// Prototype storage: each server process starts with an empty array.
// Later, replace these two methods with Prisma database operations.
function createRatingStore() {
  const ratings = [];

  return {
    async addRating({ bookId, userId, rating }) {
      const record = {
        id: randomUUID(),
        bookId,
        userId,
        rating,
        createdAt: new Date().toISOString(),
      };

      ratings.push(record);
      return { ...record };
    },

    async getAverageRating(bookId) {
      const bookRatings = ratings.filter((record) => record.bookId === bookId);

      // Provisional rule: no ratings means no average, represented by null.
      if (bookRatings.length === 0) return null;

      const total = bookRatings.reduce((sum, record) => sum + record.rating, 0);
      return total / bookRatings.length;
    },
  };
}

module.exports = { createRatingStore };
