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

  return router;
}

module.exports = { createBooksRouter };
