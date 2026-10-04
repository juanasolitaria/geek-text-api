function createWishlistStore() {
  const wishlists = new Map();

  return {
// Adds a book to a users wishlist with a given userid and bookid
    async addBook({ userId, bookId }) {
      const items = wishlists.get(userId) ?? [];

      if (items.some((item) => item.bookId === bookId)) return null;

      const item = { bookId, addedAt: new Date().toISOString() };
      wishlists.set(userId, [...items, item]);
      return { ...item };
    },

// Removes a book from a users wishlist when given a userid and bookid
    async removeBook({ userId, bookId }) {
      const items = wishlists.get(userId) ?? [];
      const remaining = items.filter((item) => item.bookId !== bookId);

      if (remaining.length === items.length) return false;

      wishlists.set(userId, remaining);
      return true;
    },

// List all books in users wishlist with a given userid
    async listBooks(userId) {
      return (wishlists.get(userId) ?? []).map((item) => ({ ...item }));
    },
  };
}

module.exports = { createWishlistStore };
