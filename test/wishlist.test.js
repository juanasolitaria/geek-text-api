const test = require("node:test");
const assert = require("node:assert/strict");
const { createWishlistStore } = require("../src/wishlist/store");

test("adds a book and returns the item with a server-generated timestamp", async () => {
  const store = createWishlistStore();
  const before = Date.now();
  const item = await store.addBook({ userId: "user-1", bookId: "book-1" });
  const after = Date.now();

  assert.equal(item.bookId, "book-1");
  assert.equal(new Date(item.addedAt).toISOString(), item.addedAt);
  assert.ok(Date.parse(item.addedAt) >= before);
  assert.ok(Date.parse(item.addedAt) <= after);
});

test("returns null and does not store a duplicate book for the same user", async () => {
  const store = createWishlistStore();
  await store.addBook({ userId: "user-1", bookId: "book-1" });
  const duplicate = await store.addBook({ userId: "user-1", bookId: "book-1" });

  assert.equal(duplicate, null);
  assert.equal((await store.listBooks("user-1")).length, 1);
});

test("allows the same book on different users' wishlists", async () => {
  const store = createWishlistStore();
  const first = await store.addBook({ userId: "user-1", bookId: "book-1" });
  const second = await store.addBook({ userId: "user-2", bookId: "book-1" });

  assert.ok(first);
  assert.ok(second);
  assert.equal((await store.listBooks("user-1")).length, 1);
  assert.equal((await store.listBooks("user-2")).length, 1);
});

test("lists books in the order they were added", async () => {
  const store = createWishlistStore();
  for (const bookId of ["book-1", "book-2", "book-3"]) {
    await store.addBook({ userId: "user-1", bookId });
  }

  const ids = (await store.listBooks("user-1")).map((item) => item.bookId);
  assert.deepEqual(ids, ["book-1", "book-2", "book-3"]);
});

test("returns an empty list for a user with no wishlist", async () => {
  const store = createWishlistStore();
  assert.deepEqual(await store.listBooks("user-with-no-wishlist"), []);
});

test("returned items are copies, so changing them does not change the store", async () => {
  const store = createWishlistStore();
  const added = await store.addBook({ userId: "user-1", bookId: "book-1" });
  added.bookId = "changed";

  const listed = await store.listBooks("user-1");
  listed[0].bookId = "changed";
  listed.push({ bookId: "extra", addedAt: "never" });

  const fresh = await store.listBooks("user-1");
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].bookId, "book-1");
});

test("removes a book and returns true, leaving the others in place", async () => {
  const store = createWishlistStore();
  await store.addBook({ userId: "user-1", bookId: "book-1" });
  await store.addBook({ userId: "user-1", bookId: "book-2" });

  const removed = await store.removeBook({ userId: "user-1", bookId: "book-1" });

  assert.equal(removed, true);
  const ids = (await store.listBooks("user-1")).map((item) => item.bookId);
  assert.deepEqual(ids, ["book-2"]);
});

test("returns false when removing a book that is not on the wishlist", async () => {
  const store = createWishlistStore();
  await store.addBook({ userId: "user-1", bookId: "book-1" });

  assert.equal(await store.removeBook({ userId: "user-1", bookId: "missing" }), false);
  assert.equal(await store.removeBook({ userId: "nobody", bookId: "book-1" }), false);
  assert.equal((await store.listBooks("user-1")).length, 1);
});

test("removing a book only affects that user's wishlist", async () => {
  const store = createWishlistStore();
  await store.addBook({ userId: "user-1", bookId: "book-1" });
  await store.addBook({ userId: "user-2", bookId: "book-1" });

  await store.removeBook({ userId: "user-1", bookId: "book-1" });

  assert.equal((await store.listBooks("user-1")).length, 0);
  assert.equal((await store.listBooks("user-2")).length, 1);
});

test("a removed book can be added again", async () => {
  const store = createWishlistStore();
  await store.addBook({ userId: "user-1", bookId: "book-1" });
  await store.removeBook({ userId: "user-1", bookId: "book-1" });

  const readded = await store.addBook({ userId: "user-1", bookId: "book-1" });
  assert.ok(readded);
  assert.equal((await store.listBooks("user-1")).length, 1);
});

test("a new store starts empty, as it will after a server restart", async () => {
  const firstStore = createWishlistStore();
  await firstStore.addBook({ userId: "user-1", bookId: "book-1" });
  const newStore = createWishlistStore();

  assert.equal((await firstStore.listBooks("user-1")).length, 1);
  assert.deepEqual(await newStore.listBooks("user-1"), []);
});
