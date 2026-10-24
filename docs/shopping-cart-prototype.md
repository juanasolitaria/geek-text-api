# Shopping cart

Owner: Juan Rincon
Project: Geek Text REST API
Scope: viewing a cart, adding a book, removing a book, and calculating the subtotal

## Implemented behavior

| Method and path | Input | Successful response |
| --- | --- | --- |
| `GET /cart/:userId` | User ID in the URL | `200 OK`, a JSON list of full Book objects currently in the cart |
| `GET /cart/:userId/subtotal` | User ID in the URL | `200 OK`, a JSON number (`0` for an empty cart) |
| `POST /cart` | JSON body with `userId` and `bookId` | `201 Created`, the created cart item (`id`, `userId`, `bookId`, `addedAt`) |
| `DELETE /cart` | JSON body with `userId` and `bookId` | `204 No Content` |

Example request body for POST and DELETE:

```json
{"userId":"user-1","bookId":"cmuufywf50000uebc72pz7mof"}
```

`bookId` must be the real `id` of a row in the `Book` table (a Prisma `cuid`).

## Database

Connected to the team's shared Supabase Postgres database via Prisma. The
`CartItem` table:

```prisma
model CartItem {
  id      String   @id @default(cuid())
  userId  String
  bookId  String
  addedAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
  book Book @relation(fields: [bookId], references: [id])

  @@unique([userId, bookId])
  @@index([userId])
}
```

Both `userId` and `bookId` have real foreign keys — `userId` to the shared
`User` table (Torin's Profile Management feature) and `bookId` to the
shared `Book` table (Gianna's Book Browsing feature). Adding an item with
either ID missing fails at the database level, and `repository.js`
translates that into a `404` with a message naming which one was wrong
("That user does not exist." vs. "That book does not exist.") by reading
which foreign key constraint Prisma reports in the error.

Note: when I ran this migration, Prisma also had to apply Torin's
`add_profiles` migration first — it had been committed to the repo but had
never actually been run against the shared Supabase database, so the
`User`/`CreditCard` tables didn't exist until this migration created them.

## Design choices to confirm with the Product Owner and team

- Adding a book that's already in the cart returns `409 Conflict` instead of
  increasing a quantity — there is no quantity field. Confirm with the team
  whether a user should be able to add the same book more than once.
- Adding a `bookId` or `userId` that doesn't exist returns `404` with a
  message naming which one was invalid.
- The subtotal is a plain sum of item prices — no tax or shipping. A book
  with no price recorded counts as `0`.

## How the files work

| File | Responsibility |
| --- | --- |
| `src/cart/routes.js` | Receive requests, validate input, choose status codes and responses |
| `src/cart/repository.js` | Talk to Supabase through Prisma: create, delete, and query `CartItem` rows |
| `test/cart.test.js` | Exercise the HTTP routes with Node's test runner, using a fake repository |

`createCartRouter` accepts a repository with four async methods: `addBook`,
`removeBook`, `listBooks`, and `getSubtotal` — the same shape Gianna used
for `books/repository.js`. The real `repository.js` translates Prisma
errors into plain return values the routes already understand: `null` means
the book is already in the cart (unique constraint), `false` means the
`bookId` doesn't exist (foreign key constraint).

The test suite never touches the real database — it injects a small fake
repository with an in-memory catalog of two sample books, so the tests run
anywhere without Supabase credentials.

## Current limits and remaining work

- `userId` has no foreign key yet, since the `User` table doesn't exist in
  `main` yet. Any non-empty string is accepted as a user ID.
- No quantity field — adding a book already in the cart is rejected rather
  than incrementing a count.
- No authentication — any caller can read or modify any user's cart.

## Acceptance checks for this increment

1. GET an empty cart for a new user; confirm it returns `[]`.
2. POST a real `bookId`; confirm it returns `201` with the created cart item.
3. GET that user's cart; confirm the full book (title, price, etc.) appears.
4. POST the same book again; confirm it returns `409` and the cart still has
   only one item.
5. POST a `bookId` that doesn't exist; confirm it returns `404`.
6. GET the subtotal; confirm it matches the sum of the real book prices.
7. DELETE the book; confirm it returns `204`, and the cart is empty again.
8. DELETE a book that isn't in the cart; confirm it returns `404`.
9. Confirm `/health` still responds with the cart router mounted.

Run `npm test` to run the whole project's suite (28 tests across ratings,
books, and cart). I also tested all 9 scenarios above by hand against the
live Supabase database (via `curl` and earlier via Postman) before and after
writing this doc, to confirm the real behavior matches what the fake-backed
tests check.

## Reporting and AI assistance

I used Claude through this entire story, from getting my environment and
GitHub branch set up to connecting to our shared Supabase database. I'm new
to Node.js, Express, Git, and Prisma, so I leaned on it heavily to
understand concepts I didn't know yet — what a Pull Request actually is,
the difference between a fork and a branch, why `git checkout` was failing
because of untracked files, how Express route parameters like `:userId`
work, and how Prisma foreign keys turn into specific error codes
(`P2002` for a duplicate, `P2003` for a missing related row) that the code
has to translate into HTTP status codes.

For the first increment (Sprint 2), I asked Claude to follow the same
pattern my teammates had already established in the codebase — an
in-memory store for now, with the same method shape a future Prisma
repository would have — so my feature would be consistent with the rest of
the team's code before the shared database was ready. It also caught a real
bug while testing: the subtotal endpoint was returning floating-point
artifacts like `44.489999999999995` instead of `44.49`, fixed by summing
prices in integer cents instead of decimals.

For this increment (Sprint 3), once I had real Supabase credentials, Claude
helped me add the `CartItem` model to the shared `prisma/schema.prisma`,
run the migration, and replace the in-memory store with a Prisma-backed
`repository.js`, following the exact pattern Gianna used for the Book
Browsing feature. It also rewrote the test suite to use a fake repository
instead of the real database, matching the approach in `books.test.js`, and
helped me diagnose two real setup problems along the way: a leftover
`[YOUR-PASSWORD]` placeholder in my `.env` that was never replaced, and a
Supabase Personal Access Token mixed in with the database password that
should never go into a database connection string.

I ran every test myself (`npm test`, 28/28 passing) and tested all 9
scenarios by hand against the live database before considering this done. I
reviewed the code with Claude explaining each piece — the repository
pattern, how Prisma error codes map to HTTP responses, and why the test
suite uses a fake repository instead of a real database connection — until
I understood how the pieces fit together.

## References

- Express routing: https://expressjs.com/en/guide/routing/
- Express API: https://expressjs.com/en/5x/api/
- Node.js test runner: https://nodejs.org/docs/latest-v24.x/api/test.html
- Prisma error reference: https://www.prisma.io/docs/orm/reference/error-reference
