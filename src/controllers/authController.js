const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function signUp(req, res) {
  const { username, displayName, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const existing = await User.findOne({
    $or: [{ username }, { email: email.toLowerCase() }],
  });
  if (existing) {
    return res.status(409).json({ error: "User already exists" });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    username,
    displayName,
    email: email.toLowerCase(),
    password: hash,
  });

  const token = signToken(user);
  res.status(201).json({
    token,
    user: {
      id: user._id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
    },
  });
}

async function signIn(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || user.accountStatus !== "active") {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken(user);
  res.json({
    token,
    user: {
      id: user._id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
    },
  });
}

async function me(req, res) {
  const user = req.user;
  res.json({
    id: user._id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
  });
}

module.exports = { signUp, signIn, me };
