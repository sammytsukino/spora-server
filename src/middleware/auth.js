const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = header.replace("Bearer ", "").trim();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user || user.accountStatus !== "active") {
      return res.status(401).json({ error: "Invalid user" });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
