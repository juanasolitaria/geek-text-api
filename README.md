# Geek Text API

REST API for **Geek Text**, an online bookstore that targets a niche in technology.
Built as the team project for **CEN 4010**.

The API exposes the endpoints a web or mobile client needs to browse books, manage user
profiles, use a shopping cart, rate and comment on books, and manage wish lists. There is
no frontend in this project. The API is tested directly with Postman.

## Tech Stack

| Component | Technology |
|---|---|
| Server / REST API | Node.js + Express |
| Database | PostgreSQL hosted on Supabase |
| ORM | Prisma |
| Language | JavaScript |
| IDE | VS Code |

## Features

Each feature is owned by one team member. Every API action is its own route.

| Feature | Owner | Actions |
|---|---|---|
| Book Browsing and Sorting | Gianna Rosa | List books by genre, top 10 sellers, books by minimum rating, discount books by publisher |
| Profile Management | Torin Sampson | Create user, get user by username, update user, create a credit card for a user |
| Shopping Cart | Juan Rincon | Get cart books, get cart subtotal, add book, remove book |
| Book Details | Donato Salas | Create book, get book by ISBN, create author, list books by author |
| Book Rating and Commenting | Rene Rodriguez | Create rating, create comment, list comments for a book, get average rating |
| Wish List Management | Brandon Robinson | Create wish list, add book, move book to cart, list books in a wish list |

## Getting Started

### Requirements

- Node.js 20.6 or newer (the start script uses `--env-file`)
- Git
- Access to the team Supabase project
- Postman, to test the endpoints

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/juanasolitaria/geek-text-api.git
   cd geek-text-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your environment file. The `.env` file is not stored in the repo, so copy the template:
   ```bash
   cp .env.example .env
   ```
   On Windows CMD use `copy .env.example .env`.

4. Open `.env` and fill in the two connection strings from the Supabase dashboard
   (the **Connect** button), replacing the password placeholder:
   - `DATABASE_URL`: transaction pooler, port 6543 (used by the app at runtime)
   - `DIRECT_URL`: session pooler, port 5432 (used by Prisma Migrate and the seed script)

   Never commit the `.env` file or share the database password.

5. Generate the Prisma client:
   ```bash
   npx prisma generate
   ```

6. Start the server:
   ```bash
   npm start
   ```
   The API runs at `http://127.0.0.1:3000`. Keep the terminal open while testing.

> The database is shared by the whole team and already contains the tables and test data.
> Do not run migrations or the seed script against it unless the team agrees first.

## Shopping Cart Endpoints

Replace `USER_ID` and `BOOK_ID` with real ids from the `User` and `Book` tables in Supabase.

| Action | Method | URL | Body |
|---|---|---|---|
| List books in the cart | `GET` | `/cart/USER_ID` | none |
| Get the cart subtotal | `GET` | `/cart/USER_ID/subtotal` | none |
| Add a book to the cart | `POST` | `/cart` | JSON with `userId` and `bookId` |
| Remove a book from the cart | `DELETE` | `/cart` | JSON with `userId` and `bookId` |

Example body for `POST /cart` and `DELETE /cart`:

```json
{
  "userId": "USER_ID",
  "bookId": "BOOK_ID"
}
```

## Testing with Postman

1. Start the server with `npm start`.
2. Choose the method in the dropdown and enter only the URL in the address bar, for example
   `http://localhost:3000/cart/USER_ID`. Do not type the method inside the URL.
3. For `POST` and `DELETE`, open **Body**, select **raw**, and change the type from **Text** to **JSON**.

Smoke test sequence for the Shopping Cart:

1. `POST /cart` adds a book (expect `201 Created`).
2. `GET /cart/USER_ID` returns the book that was added.
3. `GET /cart/USER_ID/subtotal` returns the calculated total.
4. `DELETE /cart` removes the book.
5. `GET /cart/USER_ID` returns an empty cart.

Automated tests are in the `test/` folder. See the `scripts` section of `package.json`
for how to run them.

## Troubleshooting

| Problem | Likely cause |
|---|---|
| `ECONNREFUSED 127.0.0.1:3000` in Postman | The server is not running. Run `npm start` from the project folder. |
| `npm error ENOENT ... package.json` | The terminal is in the wrong folder. Run `cd geek-text-api` first. |
| `Invalid protocol: get http:` | The method was typed in the URL bar. Choose it in the dropdown instead. |
| `Cannot POST /cart/1` (404) | `POST` and `DELETE` use `/cart`, with ids in the JSON body. |
| `tenant/user not found` or authentication errors | The connection string in `.env` is wrong. Copy it again from the Supabase **Connect** button. |
| Database connection errors | The free Supabase project may be paused. Click **Restore project** in the dashboard. |

## Project Structure

```
geek-text-api/
├── docs/        UML diagrams and developer documentation
├── prisma/      Prisma schema and database setup
├── scripts/     Helper scripts
├── src/         Express server, routes, and controllers
├── test/        Automated tests
├── .env.example Template for environment variables
└── package.json
```

## Team and Workflow

Team members: Juan Rincon, Brandon Robinson, Rene Rodriguez, Gianna Rosa, Donato Salas,
and Torin Sampson.

The team follows Scrum, with five two-week sprints. Each developer works in their own
feature branch and merges into `main` through a pull request. UML diagrams (Use Case,
Sequence, and Class) for each feature are in the `docs/` folder.

## AI Usage

AI assistants were used during development, and each team member discloses how in the
Sprint Review documents.
