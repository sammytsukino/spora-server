require("express-async-errors");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/auth");
const floraRoutes = require("./routes/floras");
const reportRoutes = require("./routes/reports");
const adminRoutes = require("./routes/admin");
const { notFound, errorHandler } = require("./middleware/error");

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/floras", floraRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
