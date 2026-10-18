const express = require("express");
const { createWishlistStore } = require("./store");

function createWishlistRouter(store = createWishlistStore()) {
  const router = express.Router();

// API Call: Retrieve users wishlist
  router.get("/users/:userId/wishlist", async (req, res) => {
    const userId = req.params.userId.trim();

    if (!userId) {
      return res.status(400).json({ error: "userId is required." });
    }

    const books = await store.listBooks(userId);
    return res.json(books);
  });

// API Call: Add a book to a user's wishlist.
  router.post("/users/:userId/wishlist/books", async (req, res) => {
    const userId = req.params.userId.trim();

    if (!userId) {
      return res.status(400).json({ error: "userId is required." });
    }

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "Send a JSON object with bookId." });
    }

    const { bookId } = req.body;
// Constraint: bookID can not be an empty string
    if (typeof bookId !== "string" || bookId.trim() === "") {
      return res.status(400).json({ error: "bookId must not be an empty string." });
    }

    const item = await store.addBook({ userId, bookId: bookId.trim() });

// Contraint: Book can only be in a wishlist once
    if (!item) {
      return res.status(409).json({ error: "That book is already on the wishlist." });
    }

    return res.status(201).json(item);
  });

// API Call: Remove a book from a user's wishlist.
  router.delete("/users/:userId/wishlist/books/:bookId", async (req, res) => {
    const userId = req.params.userId.trim();
    const bookId = req.params.bookId.trim();

    if (!userId) {
      return res.status(400).json({ error: "userId is required." });
    }

    if (!bookId) {
      return res.status(400).json({ error: "bookId is required." });
    }

    const removed = await store.removeBook({ userId, bookId });

// Constraint: Book can not be removed if book is not already on wishlist
    if (!removed) {
      return res.status(404).json({ error: "That book is not on the wishlist." });
    }

    return res.status(204).end();
  });

  return router;
}

module.exports = { createWishlistRouter };
