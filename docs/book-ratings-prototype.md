# Book ratings: local prototype

Owner: Rene Rodriguez  
Project: Geek Text REST API  
Scope: rating submission and average-rating retrieval

## Implemented behavior

| Method and path | Input | Successful response |
| --- | --- | --- |
| `POST /books/:bookId/ratings` | Book ID in the URL; JSON body with `userId` and `rating` | `201 Created`, empty body |
| `GET /books/:bookId/ratings/average` | Book ID in the URL | `200 OK`, a JSON number; `null` when there are no ratings |

Example request body:

```json
{"userId":"user-1","rating":5}
```

The server creates a record ID and a UTC timestamp when it accepts the rating.
Each record contains `id`, `bookId`, `userId`, `rating`, and `createdAt`.

The average is calculated using only the requested book's ratings. For example,
ratings of 5 and 3 give 4, while 5 and 4 give 4.5. The response is a JSON number,
not a formatted string or an object. A whole-number average can appear as `4`
instead of `4.0` in JSON.

Invalid requests get `400 Bad Request` with an `error` message for missing fields,
blank IDs, wrong field types, or unacceptable rating values. A URL that omits the
book ID does not match either route and receives Express's normal 404 response.

## Prototype choices to confirm with the Product Owner and team

These choices support local development; they are not additional assignment
requirements or finalized team policies:

- Ratings must be integer JSON numbers from 1 through 5. Fractional stars and
  numeric strings such as `"5"` are rejected.
- IDs are non-empty strings, such as `book-1` and `user-1`, with surrounding
  whitespace trimmed. Adopt the team's final ID types when integrating.
- A book with no submitted ratings returns JSON `null`, because no average exists.
- Each accepted POST currently appends a record. Repeated submissions by the same
  user for the same book are counted separately. Agree whether the final API should
  reject duplicates or update an existing rating before database integration.
- Proposed success status is 201 with no response data for POST.

## How the files work

| File | Responsibility |
| --- | --- |
| `src/ratings/routes.js` | Receive requests, validate input, choose status codes and responses |
| `src/ratings/store.js` | Temporarily store ratings and calculate averages |
| `test/ratings.test.js` | Exercise the store and real HTTP requests with Node's test runner |

`createRatingsRouter` accepts a store with two async methods: `addRating(...)` and
`getAverageRating(...)`. A future Prisma store can provide the same methods, so the
HTTP routes can keep the same structure.

The existing `app.use(express.json())` must run before the ratings router, allowing
Express to parse JSON request bodies.

## Current limits and remaining work

- Storage is an array in the server process. Restarting the server clears it.
- Sample IDs are accepted without looking up real users or books. The prototype
  does not distinguish a nonexistent book from an existing book with no ratings.
- Authentication and purchase verification are not implemented in this starter.
  Clarify how the assignment's purchased-book requirement will be verified.
- Supabase/Prisma integration and database constraints remain to be added and tested.
- Comment submission and retrieval are the next feature increment.
- Nothing in this starter deploys the application or changes the shared GitHub repo.

## Acceptance checks for this increment

1. Submit ratings of 5 and 3 for one book; retrieve an average of 4.
2. Submit 5 and 4 for another book; retrieve an average of 4.5.
3. Confirm ratings on another book do not affect either average.
4. Reject ratings outside the accepted range and malformed/missing required fields.
5. Confirm each accepted record has a server-generated timestamp.
6. Confirm POST succeeds with an empty response body.
7. Confirm a fresh store has no ratings, and `/health` remains accessible.

Run `node --test ./test/ratings.test.js` from the project root. The automated test
suite uses its own temporary HTTP servers and stores. Also run the manual requests
against your actual `src/server.js` to verify that you registered the router.

Assistant verification: all 10 tests passed using Node.js 24.19.0 and Express 5.2.1
in the preparation environment. Rene's previously reported local version is Node.js
24.21.0. Local installation and registration in Rene's server still need to be
verified by following `START-HERE.md`.

## Reporting and AI assistance

After running and passing the checks yourself, report this as: "Implemented and
tested a local prototype for rating submission and per-book average calculation
using temporary in-memory storage." Record your actual date, results, and time.

Database integration and the commenting routes remain incomplete. This increment
alone does not complete the full Book Rating and Commenting feature.

Suggested AI disclosure, if it matches your use: "Used Codex to draft the rating
routes, temporary storage, and automated tests. Reviewed the code and ran the
tests locally." Only claim review and local testing after doing them.

## References

- Express routing: https://expressjs.com/en/guide/routing/
- Express API: https://expressjs.com/en/5x/api/
- Node.js 24 test runner: https://nodejs.org/docs/latest-v24.x/api/test.html
