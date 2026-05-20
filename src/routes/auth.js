const express = require("express");
const {
  signUp,
  signIn,
  refresh,
  logout,
  me,
  updateProfile,
} = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true, 
  legacyHeaders: false,
  message: { error: "Too many requests from this IP, please try again later." }
});

const router = express.Router();

router.post("/signup", authLimiter, signUp);
router.post("/signin", authLimiter, signIn);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", requireAuth, me);
router.patch("/me", requireAuth, updateProfile);

module.exports = router;
