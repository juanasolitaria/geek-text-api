const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const express = require("express");
const { createRatingsRouter } = require("../src/ratings/routes");
const { createRatingsRepository } = require("../src/ratings/repository");

// An isolated Prisma substitute: HTTP and repository code run together,
// while automated tests never connect to the team's shared Supabase database.
function fakePrisma() {
  const ratings = [];
  const comments = [];
  return {
    ratings,
    comments,
    book: { findUnique: async ({ where }) => ["book-1", "book-2"].includes(where.id) ? { id: where.id } : null },
    user: { findUnique: async ({ where }) => ["user-1", "user-2"].includes(where.id) ? { id: where.id } : null },
    rating: {
      async create({ data }) {
        const record = { id: randomUUID(), ...data, createdAt: new Date() };
        ratings.push(record);
        return record;
      },
      async aggregate({ where }) {
        const rows = ratings.filter((record) => record.bookId === where.bookId);
        return { _avg: { rating: rows.length ? rows.reduce((sum, record) => sum + record.rating, 0) / rows.length : null } };
      },
    },
    comment: {
      async create({ data }) {
        const record = { id: String(comments.length + 1).padStart(4, "0"), ...data, createdAt: new Date() };
        comments.push(record);
        return record;
      },
      async findMany({ where }) {
        return comments.filter((record) => record.bookId === where.bookId)
          .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
      },
    },
  };
}

async function withApi(prisma, run) {
  const app = express();
  app.use(express.json());
  app.use(createRatingsRouter(createRatingsRepository(prisma)));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  }
}

function post(url, body) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

test("comments are created with 201, an empty body, and a server timestamp", async () => {
  const prisma = fakePrisma();
  await withApi(prisma, async (baseUrl) => {
    const response = await post(`${baseUrl}/books/book-1/comments`, { userId: "user-1", comment: "Useful book." });
    assert.equal(response.status, 201);
    assert.equal(await response.text(), "");
    const result = await fetch(`${baseUrl}/books/book-1/comments`);
    assert.equal(result.status, 200);
    const records = await result.json();
    assert.equal(records.length, 1);
    assert.ok(records[0].id);
    assert.equal(records[0].bookId, "book-1");
    assert.equal(records[0].userId, "user-1");
    assert.equal(records[0].comment, "Useful book.");
    assert.ok(Number.isFinite(Date.parse(records[0].createdAt)));
  });
});

test("comments are isolated by book and returned oldest first", async () => {
  await withApi(fakePrisma(), async (baseUrl) => {
    for (const [bookId, comment] of [["book-1", "First"], ["book-2", "Other book"], ["book-1", "Second"]]) {
      const response = await post(`${baseUrl}/books/${bookId}/comments`, { userId: "user-1", comment });
      assert.equal(response.status, 201);
      await response.text();
    }
    const result = await fetch(`${baseUrl}/books/book-1/comments`);
    assert.deepEqual((await result.json()).map((record) => record.comment), ["First", "Second"]);
  });
});

test("an existing book with no activity returns null for average and [] for comments", async () => {
  await withApi(fakePrisma(), async (baseUrl) => {
    const average = await fetch(`${baseUrl}/books/book-1/ratings/average`);
    assert.equal(average.status, 200);
    assert.equal(await average.json(), null);
    const comments = await fetch(`${baseUrl}/books/book-1/comments`);
    assert.equal(comments.status, 200);
    assert.deepEqual(await comments.json(), []);
  });
});

test("invalid comments and user IDs return 400 without creating records", async () => {
  const prisma = fakePrisma();
  await withApi(prisma, async (baseUrl) => {
    for (const body of [
      {}, [], { userId: "user-1" },
      ...["", "   ", "\n\t", "\0", 5, true, null, {}, []].map((comment) => ({ userId: "user-1", comment })),
      { userId: "", comment: "Text" }, { userId: 5, comment: "Text" },
      { userId: "user-\0", comment: "Text" },
    ]) {
      const response = await post(`${baseUrl}/books/book-1/comments`, body);
      assert.equal(response.status, 400);
      assert.equal(typeof (await response.json()).error, "string");
    }
    const empty = await fetch(`${baseUrl}/books/book-1/comments`, { method: "POST" });
    assert.equal(empty.status, 400);
    await empty.text();
    assert.equal(prisma.comments.length, 0);
  });
});

test("comment text and IDs are trimmed and client timestamps cannot override creation time", async () => {
  const prisma = fakePrisma();
  await withApi(prisma, async (baseUrl) => {
    const response = await post(`${baseUrl}/books/%20book-1%20/comments`, {
      userId: " user-1 ", comment: "  Recommended.  ", createdAt: "1900-01-01T00:00:00.000Z", id: "client-chosen-id",
    });
    assert.equal(response.status, 201);
    await response.text();
    assert.equal(prisma.comments[0].bookId, "book-1");
    assert.equal(prisma.comments[0].userId, "user-1");
    assert.equal(prisma.comments[0].comment, "Recommended.");
    assert.notEqual(prisma.comments[0].id, "client-chosen-id");
    assert.notEqual(prisma.comments[0].createdAt.toISOString(), "1900-01-01T00:00:00.000Z");
  });
});

test("blank book IDs are rejected by both comment routes", async () => {
  await withApi(fakePrisma(), async (baseUrl) => {
    for (const encodedId of ["%20", "%00"]) {
      for (const method of ["GET", "POST"]) {
        const response = method === "POST"
          ? await post(`${baseUrl}/books/${encodedId}/comments`, { userId: "user-1", comment: "Text" })
          : await fetch(`${baseUrl}/books/${encodedId}/comments`);
        assert.equal(response.status, 400);
        assert.equal(typeof (await response.json()).error, "string");
      }
    }
  });
});

test("all four endpoints reject a nonexistent book with 404", async () => {
  const prisma = fakePrisma();
  await withApi(prisma, async (baseUrl) => {
    for (const [suffix, body] of [
      ["ratings", { userId: "user-1", rating: 5 }],
      ["comments", { userId: "user-1", comment: "Text" }],
      ["ratings/average", null], ["comments", null],
    ]) {
      const url = `${baseUrl}/books/missing-book/${suffix}`;
      const response = body ? await post(url, body) : await fetch(url);
      assert.equal(response.status, 404);
      assert.equal((await response.json()).error, "Book not found.");
    }
    assert.equal(prisma.ratings.length, 0);
    assert.equal(prisma.comments.length, 0);
  });
});

test("rating and comment submissions require an existing user", async () => {
  const prisma = fakePrisma();
  await withApi(prisma, async (baseUrl) => {
    for (const [suffix, data] of [["ratings", { rating: 5 }], ["comments", { comment: "Text" }]]) {
      const response = await post(`${baseUrl}/books/book-1/${suffix}`, { userId: "missing-user", ...data });
      assert.equal(response.status, 404);
      assert.equal((await response.json()).error, "User not found.");
    }
    assert.equal(prisma.ratings.length, 0);
    assert.equal(prisma.comments.length, 0);
  });
});

test("the database repository preserves fractional per-book averages and repeated submissions", async () => {
  await withApi(fakePrisma(), async (baseUrl) => {
    for (const [bookId, userId, rating] of [["book-1", "user-1", 5], ["book-1", "user-1", 4], ["book-2", "user-2", 1]]) {
      const response = await post(`${baseUrl}/books/${bookId}/ratings`, { userId, rating });
      assert.equal(response.status, 201);
      assert.equal(await response.text(), "");
    }
    const first = await fetch(`${baseUrl}/books/book-1/ratings/average`);
    const second = await fetch(`${baseUrl}/books/book-2/ratings/average`);
    assert.equal(await first.json(), 4.5);
    assert.equal(await second.json(), 1);
  });
});

test("a foreign-key race becomes 404 instead of an internal database error", async () => {
  const prisma = fakePrisma();
  prisma.rating.create = async () => { throw Object.assign(new Error("reference disappeared"), { code: "P2003" }); };
  await withApi(prisma, async (baseUrl) => {
    const response = await post(`${baseUrl}/books/book-1/ratings`, { userId: "user-1", rating: 5 });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, "Book or user not found.");
  });
});

test("database failures return a generic 500 without exposing internal details", async (t) => {
  t.mock.method(console, "error", () => {});
  const prisma = fakePrisma();
  prisma.rating.aggregate = async () => { throw new Error("private database details"); };
  await withApi(prisma, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/books/book-1/ratings/average`);
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.equal(body.error, "Unable to complete the ratings or comments request.");
    assert.doesNotMatch(JSON.stringify(body), /private database details/);
  });
});

test("new API instances can retrieve data already held by their database dependency", async () => {
  const prisma = fakePrisma();
  await withApi(prisma, async (baseUrl) => {
    const rating = await post(`${baseUrl}/books/book-1/ratings`, { userId: "user-1", rating: 5 });
    assert.equal(rating.status, 201);
    await rating.text();
    const comment = await post(`${baseUrl}/books/book-1/comments`, { userId: "user-1", comment: "Still here." });
    assert.equal(comment.status, 201);
    await comment.text();
  });
  await withApi(prisma, async (baseUrl) => {
    const rating = await fetch(`${baseUrl}/books/book-1/ratings/average`);
    assert.equal(await rating.json(), 5);
    const comments = await fetch(`${baseUrl}/books/book-1/comments`);
    assert.equal((await comments.json())[0].comment, "Still here.");
  });
});
