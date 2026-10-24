const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const express = require("express");
const { createCartRouter } = require("../src/cart/routes");

const catalog = {
  "book-1": { id: "book-1", title: "Dune", author: "Frank Herbert", price: 19.99 },
  "book-2": { id: "book-2", title: "Clean Code", author: "Robert C. Martin", price: 24.5 },
};

// Stands in for the Prisma repository so the HTTP behavior can be tested
// without a database connection. Mirrors the same four methods and return
// shapes the real repository uses (null = duplicate, false = unknown book).
function createFakeRepository() {
  const carts = new Map(); // userId -> array of bookId

  return {
    async addBook({ userId, bookId }) {
      if (!catalog[bookId]) return false;

      const items = carts.get(userId) ?? [];
      if (items.includes(bookId)) return null;

      carts.set(userId, [...items, bookId]);
      return { id: `${userId}-${bookId}`, userId, bookId, addedAt: new Date().toISOString() };
    },

    async removeBook({ userId, bookId }) {
      const items = carts.get(userId) ?? [];
      if (!items.includes(bookId)) return false;

      carts.set(userId, items.filter((id) => id !== bookId));
      return true;
    },

    async listBooks(userId) {
      return (carts.get(userId) ?? []).map((bookId) => catalog[bookId]);
    },

    async getSubtotal(userId) {
      const books = (carts.get(userId) ?? []).map((bookId) => catalog[bookId]);
      const totalCents = books.reduce((sum, book) => sum + Math.round(book.price * 100), 0);
      return totalCents / 100;
    },
  };
}

async function withApi(run) {
  const app = express();
  app.use(express.json());
  app.use(createCartRouter(createFakeRepository()));
  app.get("/health", (req, res) => res.json({ status: "ok" }));

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

async function addBook(baseUrl, body) {
  return fetch(`${baseUrl}/cart`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function removeBook(baseUrl, body) {
  return fetch(`${baseUrl}/cart`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function listCart(baseUrl, userId) {
  const response = await fetch(`${baseUrl}/cart/${encodeURIComponent(userId)}`);
  assert.equal(response.status, 200);
  return response.json();
}

async function getSubtotal(baseUrl, userId) {
  const response = await fetch(`${baseUrl}/cart/${encodeURIComponent(userId)}/subtotal`);
  assert.equal(response.status, 200);
  return response.json();
}

test("the existing health route still works with the cart router mounted", async () => {
  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  });
});

test("listing an empty cart returns an empty array", async () => {
  await withApi(async (baseUrl) => {
    assert.deepEqual(await listCart(baseUrl, "user-1"), []);
  });
});

test("adding a book returns 201 with the created cart item", async () => {
  await withApi(async (baseUrl) => {
    const response = await addBook(baseUrl, { userId: "user-1", bookId: "book-1" });
    assert.equal(response.status, 201);

    const item = await response.json();
    assert.equal(item.bookId, "book-1");
    assert.ok(item.addedAt);
  });
});

test("adding a book that doesn't exist returns 404", async () => {
  await withApi(async (baseUrl) => {
    const response = await addBook(baseUrl, { userId: "user-1", bookId: "does-not-exist" });
    assert.equal(response.status, 404);
  });
});

test("a book that was added shows up as a full book object when listing the cart", async () => {
  await withApi(async (baseUrl) => {
    await addBook(baseUrl, { userId: "user-1", bookId: "book-1" });
    const items = await listCart(baseUrl, "user-1");

    assert.equal(items.length, 1);
    assert.equal(items[0].title, "Dune");
    assert.equal(items[0].price, 19.99);
  });
});

test("adding the same book twice returns 409 and does not duplicate it", async () => {
  await withApi(async (baseUrl) => {
    await addBook(baseUrl, { userId: "user-1", bookId: "book-1" });
    const second = await addBook(baseUrl, { userId: "user-1", bookId: "book-1" });

    assert.equal(second.status, 409);
    assert.equal((await listCart(baseUrl, "user-1")).length, 1);
  });
});

test("subtotal sums the real prices of every book in the cart", async () => {
  await withApi(async (baseUrl) => {
    await addBook(baseUrl, { userId: "user-1", bookId: "book-1" });
    await addBook(baseUrl, { userId: "user-1", bookId: "book-2" });

    assert.equal(await getSubtotal(baseUrl, "user-1"), 44.49);
  });
});

test("subtotal is 0 for a cart with no items", async () => {
  await withApi(async (baseUrl) => {
    assert.equal(await getSubtotal(baseUrl, "user-1"), 0);
  });
});

test("removing a book returns 204 and takes it out of the cart", async () => {
  await withApi(async (baseUrl) => {
    await addBook(baseUrl, { userId: "user-1", bookId: "book-1" });
    const response = await removeBook(baseUrl, { userId: "user-1", bookId: "book-1" });

    assert.equal(response.status, 204);
    assert.deepEqual(await listCart(baseUrl, "user-1"), []);
  });
});

test("removing a book that isn't in the cart returns 404", async () => {
  await withApi(async (baseUrl) => {
    const response = await removeBook(baseUrl, { userId: "user-1", bookId: "book-1" });
    assert.equal(response.status, 404);
  });
});

test("rejects adding a book with missing or malformed required information", async () => {
  await withApi(async (baseUrl) => {
    for (const body of [{}, { bookId: "book-1" }, { userId: "user-1" }, { userId: "", bookId: "book-1" }, { userId: "user-1", bookId: "" }]) {
      const response = await addBook(baseUrl, body);
      assert.equal(response.status, 400);
      assert.equal(typeof (await response.json()).error, "string");
    }
  });
});

test("one user's cart does not affect another user's cart", async () => {
  await withApi(async (baseUrl) => {
    await addBook(baseUrl, { userId: "user-1", bookId: "book-1" });

    assert.deepEqual(await listCart(baseUrl, "user-2"), []);
    assert.equal(await getSubtotal(baseUrl, "user-2"), 0);
  });
});
