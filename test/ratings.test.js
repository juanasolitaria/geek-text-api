const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const express = require("express");
const { createRatingsRouter } = require("../src/ratings/routes");
const { createRatingStore } = require("../src/ratings/store");

// Each HTTP test uses a fresh store and a real server on an available local port.
async function withApi(run) {
  const app = express();
  app.use(express.json());
  app.use(createRatingsRouter());
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

async function submit(baseUrl, bookId, body) {
  return fetch(`${baseUrl}/books/${encodeURIComponent(bookId)}/ratings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function average(baseUrl, bookId) {
  const response = await fetch(
    `${baseUrl}/books/${encodeURIComponent(bookId)}/ratings/average`,
  );
  assert.equal(response.status, 200);
  return response.json();
}

test("stores the rating, IDs, and a server-generated timestamp", async () => {
  const store = createRatingStore();
  const before = Date.now();
  const record = await store.addRating({ bookId: "book-1", userId: "user-1", rating: 5 });
  const after = Date.now();

  assert.equal(record.bookId, "book-1");
  assert.equal(record.userId, "user-1");
  assert.equal(record.rating, 5);
  assert.ok(record.id);
  assert.equal(new Date(record.createdAt).toISOString(), record.createdAt);
  assert.ok(Date.parse(record.createdAt) >= before);
  assert.ok(Date.parse(record.createdAt) <= after);
});

test("the existing health route still works with the ratings router", async () => {
  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  });
});

test("accepts a rating with status 201 and an empty response body", async () => {
  await withApi(async (baseUrl) => {
    const response = await submit(baseUrl, "book-1", { userId: "user-1", rating: 5 });
    assert.equal(response.status, 201);
    assert.equal(await response.text(), "");
    assert.equal(await average(baseUrl, "book-1"), 5);
  });
});

test("ratings of 5 and 3 average to 4, independently of other books", async () => {
  await withApi(async (baseUrl) => {
    for (const [bookId, userId, rating] of [
      ["book-1", "user-1", 5],
      ["book-1", "user-2", 3],
      ["book-2", "user-1", 1],
    ]) {
      const response = await submit(baseUrl, bookId, { userId, rating });
      assert.equal(response.status, 201);
      await response.text();
    }
    assert.equal(await average(baseUrl, "book-1"), 4);
    assert.equal(await average(baseUrl, "book-2"), 1);
  });
});

test("preserves a fractional average instead of rounding to whole stars", async () => {
  await withApi(async (baseUrl) => {
    for (const [userId, rating] of [["user-1", 5], ["user-2", 4]]) {
      const response = await submit(baseUrl, "book-1", { userId, rating });
      assert.equal(response.status, 201);
      await response.text();
    }
    assert.equal(await average(baseUrl, "book-1"), 4.5);
  });
});

test("rejects invalid ratings without storing them", async () => {
  await withApi(async (baseUrl) => {
    for (const rating of [-1, 0, 6, 3.5, "5", null, true, {}, []]) {
      const response = await submit(baseUrl, "book-1", { userId: "user-1", rating });
      assert.equal(response.status, 400, `Unexpected result for ${JSON.stringify(rating)}`);
      assert.equal((await response.json()).error, "rating must be a whole number from 1 to 5.");
    }
    assert.equal(await average(baseUrl, "book-1"), null);
  });
});

test("rejects missing or malformed required information", async () => {
  await withApi(async (baseUrl) => {
    for (const body of [
      {},
      { rating: 5 },
      { userId: "user-1" },
      { userId: "", rating: 5 },
      { userId: "   ", rating: 5 },
      { userId: 7, rating: 5 },
      { userId: {}, rating: 5 },
      [],
    ]) {
      const response = await submit(baseUrl, "book-1", body);
      assert.equal(response.status, 400);
      assert.equal(typeof (await response.json()).error, "string");
    }
    const emptyRequest = await fetch(`${baseUrl}/books/book-1/ratings`, { method: "POST" });
    assert.equal(emptyRequest.status, 400);
    assert.equal(typeof (await emptyRequest.json()).error, "string");
    assert.equal(await average(baseUrl, "book-1"), null);
  });
});

test("returns null when no ratings have been submitted for a book", async () => {
  await withApi(async (baseUrl) => {
    assert.equal(await average(baseUrl, "book-with-no-ratings"), null);
  });
});

test("rejects a whitespace-only book ID on both routes", async () => {
  await withApi(async (baseUrl) => {
    const response = await submit(baseUrl, " ", { userId: "user-1", rating: 5 });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "bookId is required.");

    const result = await fetch(`${baseUrl}/books/%20/ratings/average`);
    assert.equal(result.status, 400);
    assert.equal((await result.json()).error, "bookId is required.");
  });
});

test("a new store starts empty, as it will after a server restart", async () => {
  const firstStore = createRatingStore();
  await firstStore.addRating({ bookId: "book-1", userId: "user-1", rating: 5 });
  const newStore = createRatingStore();
  assert.equal(await firstStore.getAverageRating("book-1"), 5);
  assert.equal(await newStore.getAverageRating("book-1"), null);
});
