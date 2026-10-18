# Shopping cart: local prototype

Owner: Juan Rincon
Project: Geek Text REST API
Scope: viewing a cart, adding a book, removing a book, and calculating the subtotal

## Implemented behavior

| Method and path | Input | Successful response |
| --- | --- | --- |
| `GET /cart/:userId` | User ID in the URL | `200 OK`, a JSON list of cart items |
| `GET /cart/:userId/subtotal` | User ID in the URL | `200 OK`, a JSON number (`0` for an empty cart) |
| `POST /cart` | JSON body with `userId` and `bookId` | `201 Created`, the created item |
| `DELETE /cart` | JSON body with `userId` and `bookId` | `204 No Content` |

Example request body for POST and DELETE:

```json
{"userId":"user-1","bookId":"book-1"}
```

Each cart item has a `bookId` and a server-generated `addedAt` timestamp.

## Prototype choices to confirm with the Product Owner and team

These choices support local development; they are not additional assignment
requirements or finalized team policies:

- Book prices come from a temporary hardcoded list (`FAKE_BOOK_PRICES`) in
  `store.js`, not from the real `Book` table, since Shopping Cart isn't
  connected to Supabase yet. Three sample IDs (`book-1`, `book-2`, `book-3`)
  have realistic prices; any other book ID is treated as free.
- Adding a book that's already in the cart returns `409 Conflict` instead of
  increasing a quantity — there is no quantity field. Confirm with the team
  whether a user should be able to add the same book more than once.
- IDs are non-empty strings, such as `user-1` and `book-1`. Adopt the real
  `User` and `Book` ID types (Gianna's `Book` model uses `cuid()`) once this
  connects to Prisma.
- The subtotal is a plain sum of item prices — no tax or shipping.
- Proposed success responses: `201` with the created item for POST, `204`
  with no body for DELETE.

## How the files work

| File | Responsibility |
| --- | --- |
| `src/cart/routes.js` | Receive requests, validate input, choose status codes and responses |
| `src/cart/store.js` | Temporarily store cart items in memory and calculate subtotals |
| `test/cart.test.js` | Exercise the store and real HTTP requests with Node's test runner |

`createCartRouter` accepts a store with four async methods: `addBook`,
`removeBook`, `listBooks`, and `getSubtotal`. A future Prisma-backed
repository can provide the same four methods, so the HTTP routes won't need
to change — the same approach Gianna used for `books/repository.js`.

The existing `app.use(express.json())` in `server.js` must run before the
cart router, so Express can parse the JSON body on POST and DELETE.

## Current limits and remaining work

- Storage is a `Map` in the server process. Restarting the server clears
  every user's cart.
- Book prices are a temporary hardcoded list, not the real `Book` table —
  the subtotal is only realistic for the three sample book IDs.
- There is no check that a `userId` or `bookId` actually exists; any
  non-empty string is accepted.
- Supabase/Prisma integration remains to be added once I have the
  connection credentials from the team's shared Supabase project.

## Acceptance checks for this increment

1. GET an empty cart for a new user; confirm it returns `[]`.
2. POST a book; confirm it returns `201` with the created item.
3. GET that user's cart; confirm the book appears.
4. POST the same book again; confirm it returns `409` and the cart still
   has only one item.
5. GET the subtotal; confirm it matches the sum of the sample prices (for
   example, `book-1` + `book-2` = `44.49`).
6. DELETE the book; confirm it returns `204`, and the cart is empty again.
7. DELETE a book that isn't in the cart; confirm it returns `404`.
8. Confirm `/health` still responds with the cart router mounted.

Run `node --test test/cart.test.js` from the project root, or `npm test` to
run the whole project's suite (28 tests across ratings, books, and cart as
of this increment). I also tested every endpoint by hand in Postman against
a running `src/server.js` before writing the automated tests, to confirm
the real behavior matched what the tests check.

## Reporting and AI assistance

I used Claude through this entire story, from getting my environment and
GitHub branch set up to writing the final code. I'm new to Node.js,
Express, Git, and Prisma, so I leaned on it heavily to understand concepts
I didn't know yet — what a Pull Request actually is, the difference between
a fork and a branch (which came up when a teammate's PR needed to be moved
from her fork into a branch on our shared repo), why `git checkout` was
failing because of untracked files, and how Express route parameters like
`:userId` work.

For the implementation, I asked Claude to follow the same pattern my
teammates had already established in the codebase (an in-memory store for
now, with the same shape a future Prisma repository will have) instead of
the database-first approach we originally sketched out, so my feature would
be consistent with the rest of the team's code. Claude wrote the first
version of `store.js`, `routes.js`, and `test/cart.test.js`, and caught a
real bug while testing: the subtotal endpoint was returning floating-point
artifacts like `44.489999999999995` instead of `44.49`, which it fixed by
summing prices in integer cents instead of decimals.

I tested every endpoint myself by hand in Postman before any automated test
existed, and I ran the full test suite myself to confirm all 28 tests pass.
I reviewed the code with Claude explaining each piece until I understood
how the pieces fit together (route parameters, the store's dependency
injection pattern, why the test suite spins up a real server on a random
port).

## References

- Express routing: https://expressjs.com/en/guide/routing/
- Express API: https://expressjs.com/en/5x/api/
- Node.js test runner: https://nodejs.org/docs/latest-v24.x/api/test.html
