const express = require("express");

const { createRatingsRouter } = require("./ratings/routes");
const { createWishlistRouter } = require("./wishlist/routes");
const { createBooksRouter } = require("./books/routes");
const { createProfilesRouter } = require("./profiles/routes");
const { createCartRouter } = require("./cart/routes");

const app = express();

app.use("/users", createProfilesRouter());
app.use(express.json());

app.use(createRatingsRouter());
app.use(createWishlistRouter());
app.use(createBooksRouter());
app.use(createCartRouter());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(3000, "127.0.0.1", () => {
  console.log("API running at http://127.0.0.1:3000");
});
