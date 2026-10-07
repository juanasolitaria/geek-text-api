// Temporary stand-in for the Book feature's price data. Replace with a real
// lookup (Prisma `book.findUnique`) once the shared Book model is merged
// into main and connected to Supabase.
const FAKE_BOOK_PRICES = {
  "book-1": 19.99,
  "book-2": 24.5,
  "book-3": 12.0,
};

function createCartStore() {
  const carts = new Map(); // userId -> array of { bookId, addedAt }

  return {
    // Adds a book to a user's cart. Returns null if it's already there.
    async addBook({ userId, bookId }) {
      const items = carts.get(userId) ?? [];

      if (items.some((item) => item.bookId === bookId)) return null;

      const item = { bookId, addedAt: new Date().toISOString() };
      carts.set(userId, [...items, item]);
      return { ...item };
    },

    // Removes a book from a user's cart. Returns false if it wasn't there.
    async removeBook({ userId, bookId }) {
      const items = carts.get(userId) ?? [];
      const remaining = items.filter((item) => item.bookId !== bookId);

      if (remaining.length === items.length) return false;

      carts.set(userId, remaining);
      return true;
    },

    // Lists the items currently in a user's cart.
    async listBooks(userId) {
      return (carts.get(userId) ?? []).map((item) => ({ ...item }));
    },

    // Sums the price of every book in a user's cart. Sums in integer cents
    // first to avoid floating-point drift (e.g. 19.99 + 24.5 !== 44.49).
    async getSubtotal(userId) {
      const items = carts.get(userId) ?? [];
      const totalCents = items.reduce((sum, item) => {
        const price = FAKE_BOOK_PRICES[item.bookId] ?? 0;
        return sum + Math.round(price * 100);
      }, 0);
      return totalCents / 100;
    },
  };
}

module.exports = { createCartStore, FAKE_BOOK_PRICES };
