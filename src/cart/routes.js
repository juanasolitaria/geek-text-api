const express = require("express");
const { createCartStore } = require("./store");

function createCartRouter(store = createCartStore()) {
  const router = express.Router();

  // API Call: Retrieve the list of books in a user's shopping cart.
  router.get("/cart/:userId", async (req, res) => {
    const userId = req.params.userId.trim();

    if (!userId) {
      return res.status(400).json({ error: "userId is required." });
    }

    const items = await store.listBooks(userId);
    return res.json(items);
  });

  // API Call: Retrieve the subtotal price of all items in a user's cart.
  router.get("/cart/:userId/subtotal", async (req, res) => {
    const userId = req.params.userId.trim();

    if (!userId) {
      return res.status(400).json({ error: "userId is required." });
    }

    const subtotal = await store.getSubtotal(userId);
    return res.json(subtotal);
  });

  // API Call: Add a book to a user's shopping cart.
  router.post("/cart", async (req, res) => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "Send a JSON object with userId and bookId." });
    }

    const { userId, bookId } = req.body;

    if (typeof userId !== "string" || userId.trim() === "") {
      return res.status(400).json({ error: "userId must be a non-empty string." });
    }

    if (typeof bookId !== "string" || bookId.trim() === "") {
      return res.status(400).json({ error: "bookId must be a non-empty string." });
    }

    const item = await store.addBook({ userId: userId.trim(), bookId: bookId.trim() });

    if (!item) {
      return res.status(409).json({ error: "That book is already in the cart." });
    }

    return res.status(201).json(item);
  });

  // API Call: Remove a book from a user's shopping cart.
  router.delete("/cart", async (req, res) => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "Send a JSON object with userId and bookId." });
    }

    const { userId, bookId } = req.body;

    if (typeof userId !== "string" || userId.trim() === "") {
      return res.status(400).json({ error: "userId must be a non-empty string." });
    }

    if (typeof bookId !== "string" || bookId.trim() === "") {
      return res.status(400).json({ error: "bookId must be a non-empty string." });
    }

    const removed = await store.removeBook({ userId: userId.trim(), bookId: bookId.trim() });

    if (!removed) {
      return res.status(404).json({ error: "That book is not in the cart." });
    }

    return res.status(204).end();
  });

  return router;
}

module.exports = { createCartRouter };
