const express = require("express");

const { createRatingsRouter } = require("./ratings/routes");
const { createBooksRouter } = require("./books/routes");
const { createProfilesRouter } = require("./profiles/routes");

const app = express();

app.use("/users", createProfilesRouter());
app.use(express.json());

app.use(createRatingsRouter());
app.use(createBooksRouter());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(3000, "127.0.0.1", () => {
  console.log("API running at http://127.0.0.1:3000");
});
