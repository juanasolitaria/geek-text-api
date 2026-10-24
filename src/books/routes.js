const express = require("express");
const { createBookRepository } = require("./repository");

const SORT_KEYS = ["title", "author", "price"];
const SORT_ORDERS = ["asc", "desc"];

function createBooksRouter(repository = createBookRepository()) {
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
