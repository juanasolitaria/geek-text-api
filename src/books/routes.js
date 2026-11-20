const express = require("express");
const { timingSafeEqual } = require("node:crypto");
const { createBookRepository } = require("./repository");

const SORT_KEYS = ["title", "author", "price"];
const SORT_ORDERS = ["asc", "desc"];

function readText(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= 120 && !text.includes("\0") ? text : null;
}

function requireDiscountToken(token) {
  const expected = Buffer.from(token ?? "");

  return (req, res, next) => {
    if (!expected.length) {
      return res.status(503).json({ error: "Publisher discounts are not configured." });
    }

    const match = /^Bearer (\S+)$/i.exec(req.get("authorization") ?? "");
    const supplied = Buffer.from(match?.[1] ?? "");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      res.set("WWW-Authenticate", "Bearer");
      return res.status(401).json({ error: "A valid discount token is required." });
    }

    return next();
  };
}

function createBooksRouter(
  repository = createBookRepository(),
  { discountToken = process.env.BOOK_DISCOUNT_TOKEN } = {},
) {
  const router = express.Router();

  router.get("/books", async (req, res) => {
    const sortBy = String(req.query.sort ?? "title").toLowerCase();
    const order = String(req.query.order ?? "asc").toLowerCase();

    if (!SORT_KEYS.includes(sortBy)) {
      return res.status(400).json({ error: `sort must be one of: ${SORT_KEYS.join(", ")}.` });
    }

    if (!SORT_ORDERS.includes(order)) {
      return res.status(400).json({ error: `order must be one of: ${SORT_ORDERS.join(", ")}.` });
    }

    const books = await repository.listBooks({ sortBy, order });
    return res.json(books);
  });

  router.get("/books/by-genre", async (req, res) => {
    const genre = readText(req.query.genre);
    if (genre === null) {
      return res.status(400).json({ error: "genre must be a non-empty string up to 120 characters." });
    }

    return res.json(await repository.listBooksByGenre(genre));
  });

  router.get("/books/top-sellers", async (_req, res) => {
    return res.json(await repository.listTopSellers());
  });

  router.get("/books/by-rating", async (req, res) => {
    const value = readText(req.query.minRating);
    const minRating = value !== null && /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : NaN;
    if (!Number.isFinite(minRating) || minRating < 1 || minRating > 5) {
      return res.status(400).json({ error: "minRating must be a number from 1 to 5." });
    }

    return res.json(await repository.listBooksByMinRating(minRating));
  });

  router.patch("/books/discounts/by-publisher", requireDiscountToken(discountToken), async (req, res) => {
    const publisher = readText(req.body?.publisher);
    const { percentage } = req.body ?? {};
    if (publisher === null) {
      return res.status(400).json({ error: "publisher must be a non-empty string up to 120 characters." });
    }
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
      return res.status(400).json({ error: "percentage must be a number greater than 0 and at most 100." });
    }

    const updatedCount = await repository.discountBooksByPublisher(publisher, percentage);
    return res.json({ updatedCount });
  });

  // Book details: GET /books/:id returns one book, or 404 if it doesn't exist.
  router.get("/books/:id", async (req, res) => {
    const book = await repository.getBookById(req.params.id);

    if (!book) {
      return res.status(404).json({ error: "Book not found." });
    }

    return res.json(book);
  });

  return router;
}

module.exports = { createBooksRouter };
