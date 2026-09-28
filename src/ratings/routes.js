const express = require("express");
const { createRatingStore } = require("./store");

function createRatingsRouter(store = createRatingStore()) {
  const router = express.Router();

  router.post("/books/:bookId/ratings", async (req, res) => {
    const bookId = req.params.bookId.trim();

    if (!bookId) {
      return res.status(400).json({ error: "bookId is required." });
    }

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "Send a JSON object with userId and rating." });
    }

    const { userId, rating } = req.body;

    // Temporary string IDs let us test before the shared database schema exists.
    if (typeof userId !== "string" || userId.trim() === "") {
      return res.status(400).json({ error: "userId must be a non-empty string." });
    }

    // Provisional rule: accept whole-star ratings only.
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "rating must be a whole number from 1 to 5." });
    }

    await store.addRating({ bookId, userId: userId.trim(), rating });

    // The assignment specifies no response data for creating a rating.
    return res.status(201).end();
  });

  router.get("/books/:bookId/ratings/average", async (req, res) => {
    const bookId = req.params.bookId.trim();

    if (!bookId) {
      return res.status(400).json({ error: "bookId is required." });
    }

    const average = await store.getAverageRating(bookId);
    return res.json(average);
  });

  return router;
}

module.exports = { createRatingsRouter };
