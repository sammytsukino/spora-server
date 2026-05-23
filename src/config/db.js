const mongoose = require("mongoose");

function getMongoUri() {
  const fromEnv = process.env.MONGODB_URI?.trim() || process.env.MONGO_URL?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("MONGODB_URI or MONGO_URL is required in production");
  }
  return "mongodb://localhost:27017/sporadb";
}

async function connectDb() {
  const mongoUrl = getMongoUri();
  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUrl, {
    autoIndex: true,
  });
}

module.exports = { connectDb };
