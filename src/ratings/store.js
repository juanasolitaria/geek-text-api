const { randomUUID } = require("node:crypto");

// Isolated in-memory test double. Production defaults to repository.js.
function createRatingStore() {
  const ratings = [];
  const comments = [];

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

    async addComment({ bookId, userId, comment }) {
      const record = { id: randomUUID(), bookId, userId, comment, createdAt: new Date().toISOString() };
      comments.push(record);
      return { ...record };
    },

    async getComments(bookId) {
      return comments.filter((record) => record.bookId === bookId).map((record) => ({ ...record }));
    },
  };
}

module.exports = { createRatingStore };
