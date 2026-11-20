# Book Browsing and Sorting

The routes below are in addition to `GET /books` and `GET /books/:id`.
The catalog still accepts `sort=title`, `sort=author`, or `sort=price`,
with `order=asc` or `order=desc`.

| Action | Method | URL | Input |
|---|---|---|---|
| List books by genre | `GET` | `/books/by-genre?genre=Science%20Fiction` | Exact genre, case-insensitive |
| List the top 10 sellers | `GET` | `/books/top-sellers` | None |
| List books by minimum rating | `GET` | `/books/by-rating?minRating=4` | Minimum average, inclusive, from 1 to 5 |
| Discount books by publisher | `PATCH` | `/books/discounts/by-publisher` | JSON body with `publisher` and `percentage`, plus a bearer token |

## Database setup

Copy `.env.example` to `.env` and fill in your database connection strings. Use the
transaction pooler on port 6543 for `DATABASE_URL` and the session pooler on port 5432
for `DIRECT_URL`. Do not commit `.env`.

The migration `20261120010000_add_book_browsing_fields` adds `publisher` and
`copiesSold` to `Book`. Check pending migrations with `npx prisma migrate status`.
Use `npm run db:deploy` only on an isolated demo database or after the team approves
all pending migrations for the shared database.

## What to show in Postman

- Genre: try the same genre in different letter cases.
- Top sellers: the query ranks books by `copiesSold` and omits books with zero sales.
  The API does not have checkout, so adding an item to a cart does not count as a sale.
- Minimum rating: the response includes `averageRating` and omits unrated books.
  Ratings come from the existing ratings feature.
- Publisher discount: set `BOOK_DISCOUNT_TOKEN` in your local `.env` to a private random
  value to enable price changes. In Postman, select Bearer Token under Authorization
  and enter that value. Use a JSON body such as:

  ```json
  { "publisher": "Demo Press", "percentage": 10 }
  ```

  The response reports `updatedCount`. Publisher names match without regard to case.
  The query skips books without prices and rounds prices to cents. Repeating a successful
  request applies another discount to current prices.

Existing books start with no publisher and zero recorded sales. For a demo, use a
separate database and give a few books publishers, sales counts, and ratings.
Check the affected prices with `GET /books` after applying the discount.
