const mongoose = require("mongoose");

async function connectDb() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    throw new Error("MONGO_URL is required");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUrl, {
    autoIndex: true,
  });
}

module.exports = { connectDb };
