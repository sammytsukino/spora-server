require("dotenv").config();
const app = require("./app");
const { connectDb } = require("./config/db");

const port = process.env.PORT || 4000;

connectDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Spora backend listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  });
