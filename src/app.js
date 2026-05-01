require("express-async-errors");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth");
const floraRoutes = require("./routes/floras");
const reportRoutes = require("./routes/reports");
const adminRoutes = require("./routes/admin");
const followRoutes = require("./routes/follows");
const userRoutes = require("./routes/users");
const readerRoutes = require("./routes/reader");
const contactRoutes = require("./routes/contact");
const { notFound, errorHandler } = require("./middleware/error");
const { parseCorsOrigin } = require("./lib/parseCorsOrigin");
const { applyTrustProxyIfProduction } = require("./lib/trustProxy");

const app = express();

applyTrustProxyIfProduction(app);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin: parseCorsOrigin(),
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/floras", floraRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/follows", followRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reader", readerRoutes);
app.use("/api/contact", contactRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
