const express = require("express");
const {
  signUp,
  signIn,
  refresh,
  logout,
  me,
  updateProfile,
  verifyEmail,
  resendVerification,
} = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/signup", signUp);
router.get("/verify-email", verifyEmail);
router.post("/verify-email", (req, res, next) => {
  req.query = { ...req.query, token: req.body?.token };
  verifyEmail(req, res).catch(next);
});
router.post("/resend-verification", resendVerification);
router.post("/signin", signIn);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", requireAuth, me);
router.patch("/me", requireAuth, updateProfile);

module.exports = router;
