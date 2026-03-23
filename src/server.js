const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const app = require("./app");
const { connectDb } = require("./config/db");

const port = process.env.PORT || 4000;

connectDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Spora backend listening on port ${port}`);
      if (!process.env.ELEVENLABS_API_KEY?.trim() || !process.env.ELEVENLABS_VOICE_ID?.trim()) {
        console.log(
          "[reader/tts] ElevenLabs not configured: set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in spora-server/.env"
        );
      }
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  });
