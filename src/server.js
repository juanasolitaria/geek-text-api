const express = require("express");

const { createRatingsRouter } = require("./ratings/routes");
const { createWishlistRouter } = require("./wishlist/routes");
const { createBooksRouter } = require("./books/routes");
const { createProfilesRouter } = require("./profiles/routes");
const { createProfileRepository } = require("./profiles/repository");
const { createCartRouter } = require("./cart/routes");

const app = express();
const accounts = createProfileRepository();

app.use("/users", createProfilesRouter(accounts));
app.use(express.json());

app.use(createRatingsRouter(undefined, accounts));
app.use(createWishlistRouter());
app.use(createBooksRouter());
app.use(createCartRouter());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(3000, "127.0.0.1", () => {
  console.log("API running at http://127.0.0.1:3000");
});
