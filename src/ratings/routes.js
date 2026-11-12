const express = require("express");
const { createBasicAuth } = require("../auth/basic");
const { createProfileRepository } = require("../profiles/repository");
const { createRatingsRepository, RatingResourceNotFoundError } = require("./repository");

class RatingInputError extends Error {}
class RatingAuthorMismatchError extends Error {}

function readBookId(req) {
  const bookId = req.params.bookId.trim();
  if (!bookId) throw new RatingInputError("bookId is required.");
  if (bookId.includes("\0")) throw new RatingInputError("bookId must not contain null characters.");
  return bookId;
}

function readAuthorId(req, field) {
  const { body } = req;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RatingInputError(`Send a JSON object with userId and ${field}.`);
  }
  if (typeof body.userId !== "string" || body.userId.trim() === "") {
    throw new RatingInputError("userId must be a non-empty string.");
  }
  if (body.userId.includes("\0")) throw new RatingInputError("userId must not contain null characters.");
  if (body.userId.trim() !== req.account.id) {
    throw new RatingAuthorMismatchError("userId must match the authenticated account.");
  }
  return req.account.id;
}

// Production uses Prisma; tests supply isolated repositories.
function createRatingsRouter(repository = createRatingsRepository(), accounts = createProfileRepository()) {
  const router = express.Router();
  const authenticate = createBasicAuth(accounts, "Book Ratings and Comments");

  router.post("/books/:bookId/ratings", authenticate, async (req, res) => {
    const bookId = readBookId(req);
    const userId = readAuthorId(req, "rating");
    const { rating } = req.body;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new RatingInputError("rating must be a whole number from 1 to 5.");
    }
    await repository.addRating({ bookId, userId, rating });
    return res.status(201).end();
  });

  router.get("/books/:bookId/ratings/average", async (req, res) => {
    const average = await repository.getAverageRating(readBookId(req));
    return res.json(average);
  });

  router.post("/books/:bookId/comments", authenticate, async (req, res) => {
    const bookId = readBookId(req);
    const userId = readAuthorId(req, "comment");
    if (typeof req.body.comment !== "string" || req.body.comment.trim() === "") {
      throw new RatingInputError("comment must be a non-empty string.");
    }
    if (req.body.comment.includes("\0")) throw new RatingInputError("comment must not contain null characters.");
    await repository.addComment({ bookId, userId, comment: req.body.comment.trim() });
    return res.status(201).end();
  });

  router.get("/books/:bookId/comments", async (req, res) => {
    const comments = await repository.getComments(readBookId(req));
    return res.json(comments);
  });

  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof RatingInputError) return res.status(400).json({ error: error.message });
    if (error instanceof RatingAuthorMismatchError) return res.status(403).json({ error: error.message });
    if (error instanceof RatingResourceNotFoundError) return res.status(404).json({ error: error.message });
    // Avoid returning database connection details or raw Prisma errors.
    console.error("A ratings/comments database operation failed.", { code: error.code || "unknown" });
    return res.status(500).json({ error: "Unable to complete the ratings or comments request." });
  });

  return router;
}

module.exports = { createRatingsRouter };
