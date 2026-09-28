const express = require("express");

const { createRatingsRouter } = require("./ratings/routes");

const app = express();

app.use(express.json());

app.use(createRatingsRouter());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(3000, "127.0.0.1", () => {
  console.log("API running at http://127.0.0.1:3000");
});