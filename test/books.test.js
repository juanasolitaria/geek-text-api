const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const express = require("express");
const { createBooksRouter } = require("../src/books/routes");

const catalog = [
  { id: "3", title: "Dune", author: "Frank Herbert", price: 18.75 },
  { id: "1", title: "Clean Code", author: "Robert C. Martin", price: 42.5 },
  { id: "2", title: "The Pragmatic Programmer", author: "Andrew Hunt", price: 49.99 },
];

// Stands in for the Prisma repository so the HTTP behavior can be tested
// without a database connection.
function createFakeRepository(books = catalog) {
  const calls = [];
  return {
    calls,
    async listBooks({ sortBy, order }) {
      calls.push({ sortBy, order });
      const direction = order === "desc" ? -1 : 1;
      return [...books].sort((a, b) => {
        if (a[sortBy] < b[sortBy]) return -direction;
        if (a[sortBy] > b[sortBy]) return direction;
        return 0;
      });
    },
  };
}

async function withApi(repository, run) {
  const app = express();
  app.use(createBooksRouter(repository));

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  }
}

test("returns the catalog as JSON ordered by title by default", async () => {
  const repository = createFakeRepository();
  await withApi(repository, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/books`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/json/);

    const books = await response.json();
    assert.deepEqual(
      books.map((book) => book.title),
      ["Clean Code", "Dune", "The Pragmatic Programmer"],
    );
    assert.deepEqual(repository.calls, [{ sortBy: "title", order: "asc" }]);
  });
});

test("orders the results by author when sort=author is requested", async () => {
  await withApi(createFakeRepository(), async (baseUrl) => {
    const books = await (await fetch(`${baseUrl}/books?sort=author`)).json();
    assert.deepEqual(
      books.map((book) => book.author),
      ["Andrew Hunt", "Frank Herbert", "Robert C. Martin"],
    );
  });
});

test("reverses the order when order=desc is requested", async () => {
  await withApi(createFakeRepository(), async (baseUrl) => {
    const books = await (await fetch(`${baseUrl}/books?sort=author&order=desc`)).json();
    assert.deepEqual(
      books.map((book) => book.author),
      ["Robert C. Martin", "Frank Herbert", "Andrew Hunt"],
    );
  });
});

test("orders numeric fields such as price", async () => {
  await withApi(createFakeRepository(), async (baseUrl) => {
    const books = await (await fetch(`${baseUrl}/books?sort=price`)).json();
    assert.deepEqual(
      books.map((book) => book.price),
      [18.75, 42.5, 49.99],
    );
  });
});

test("rejects an unsupported sort field without querying the repository", async () => {
  const repository = createFakeRepository();
  await withApi(repository, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/books?sort=isbn`);
    assert.equal(response.status, 400);
    assert.equal(
      (await response.json()).error,
      "sort must be one of: title, author, price.",
    );
    assert.equal(repository.calls.length, 0);
  });
});

test("rejects an unsupported order direction", async () => {
  await withApi(createFakeRepository(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/books?order=random`);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "order must be one of: asc, desc.");
  });
});
