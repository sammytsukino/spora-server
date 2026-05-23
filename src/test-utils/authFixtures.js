const jwt = require("jsonwebtoken");

const DEFAULT_USER_ID = "507f1f77bcf86cd799439011";
const OTHER_USER_ID = "507f1f77bcf86cd799439012";

function signAccessToken(userId, role) {
  return jwt.sign({ sub: userId, role, type: "access" }, process.env.JWT_SECRET);
}

function adminToken(userId = DEFAULT_USER_ID) {
  return signAccessToken(userId, "admin");
}

function cultivatorToken(userId = DEFAULT_USER_ID) {
  return signAccessToken(userId, "cultivator");
}

function activeUserDoc(userId = DEFAULT_USER_ID, role = "cultivator", overrides = {}) {
  return {
    _id: userId,
    username: "testuser",
    displayName: "Test User",
    role,
    accountStatus: "active",
    email: "test@example.com",
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

module.exports = {
  DEFAULT_USER_ID,
  OTHER_USER_ID,
  adminToken,
  cultivatorToken,
  activeUserDoc,
};
