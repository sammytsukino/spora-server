const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const app = require("./app");
const { connectDb } = require("./config/db");

const port = process.env.PORT || 4000;

connectDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Spora backend listening on port ${port}`);
      console.log("[reader/tts] VoiPi enabled with provider fallback: edge-tts -> google-tts -> piper");
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  });
