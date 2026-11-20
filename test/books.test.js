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

async function withApi(repository, run, options = { discountToken: "" }) {
  const app = express();
  app.use(express.json());
  app.use(createBooksRouter(repository, options));

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

test("lists books for the requested genre without treating the path as a book ID", async () => {
  const repository = {
    async listBooksByGenre(genre) {
      assert.equal(genre, "Science Fiction");
      return [catalog[0]];
    },
  };

  await withApi(repository, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/books/by-genre?genre=%20Science%20Fiction%20`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [catalog[0]]);
  });
});

test("rejects missing, blank, repeated, or invalid genre values", async () => {
  await withApi({}, async (baseUrl) => {
    for (const query of ["", "?genre=%20", "?genre=a&genre=b", "?genre=%00"]) {
      const response = await fetch(`${baseUrl}/books/by-genre${query}`);
      assert.equal(response.status, 400);
    }
  });
});

test("lists the ranked sellers from the repository", async () => {
  const sellers = [
    { ...catalog[0], copiesSold: 25 },
    { ...catalog[2], copiesSold: 10 },
  ];
  const repository = { async listTopSellers() { return sellers; } };

  await withApi(repository, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/books/top-sellers`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), sellers);
  });
});

test("passes a fractional minimum rating to the repository", async () => {
  const rated = { ...catalog[1], averageRating: 4.5 };
  const repository = {
    async listBooksByMinRating(minRating) {
      assert.equal(minRating, 4.5);
      return [rated];
    },
  };

  await withApi(repository, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/books/by-rating?minRating=4.5`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [rated]);
  });
});

test("rejects missing, out-of-range, repeated, or nonnumeric minimum ratings", async () => {
  await withApi({}, async (baseUrl) => {
    for (const query of ["", "?minRating=0", "?minRating=5.01", "?minRating=a", "?minRating=4&minRating=5"]) {
      const response = await fetch(`${baseUrl}/books/by-rating${query}`);
      assert.equal(response.status, 400);
    }
  });
});

function sendDiscount(baseUrl, body, token) {
  return fetch(`${baseUrl}/books/discounts/by-publisher`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });
}

test("disables publisher discounts when a token has not been configured", async () => {
  await withApi({}, async (baseUrl) => {
    const response = await sendDiscount(baseUrl, { publisher: "Demo Press", percentage: 10 }, "test-token");
    assert.equal(response.status, 503);
  });
});

test("requires the configured bearer token for publisher discounts", async () => {
  await withApi({}, async (baseUrl) => {
    const body = { publisher: "Demo Press", percentage: 10 };
    for (const token of [undefined, "wrong-auth", "wrong"]) {
      const response = await sendDiscount(baseUrl, body, token);
      assert.equal(response.status, 401);
      assert.equal(response.headers.get("www-authenticate"), "Bearer");
    }
  }, { discountToken: "test-token" });
});

test("rejects discounts with an invalid publisher or percentage", async () => {
  await withApi({}, async (baseUrl) => {
    for (const body of [
      { publisher: "", percentage: 10 },
      { publisher: "Demo Press", percentage: "10" },
      { publisher: "Demo Press", percentage: -1 },
      { publisher: "Demo Press", percentage: 101 },
      { publisher: "Demo Press", percentage: 0 },
    ]) {
      const response = await sendDiscount(baseUrl, body, "test-token");
      assert.equal(response.status, 400);
    }
  }, { discountToken: "test-token" });
});

test("applies a valid publisher discount and returns the number of affected books", async () => {
  const repository = {
    async discountBooksByPublisher(publisher, percentage) {
      assert.equal(publisher, "Demo Press");
      assert.equal(percentage, 12.5);
      return 2;
    },
  };

  await withApi(repository, async (baseUrl) => {
    const response = await sendDiscount(baseUrl, { publisher: " Demo Press ", percentage: 12.5 }, "test-token");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { updatedCount: 2 });
  }, { discountToken: "test-token" });
});

test("GET /books/:id returns the requested book", async () => {
  const book = {
    id: "1",
    title: "Clean Code",
    author: "Robert C. Martin",
    price: 42.5,
  };

  const repository = {
    async getBookById(id) {
      return id === book.id ? book : null;
    },
  };

  await withApi(repository, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/books/1`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), book);
  });
});

test("GET /books/:id returns 404 for a missing book", async () => {
  const repository = {
    async getBookById() {
      return null;
    },
  };

  await withApi(repository, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/books/missing`);
    assert.equal(response.status, 404);
    assert.equal(
      (await response.json()).error,
      "Book not found."
    );
  });
});
