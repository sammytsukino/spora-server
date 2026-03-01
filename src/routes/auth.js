const express = require("express");
const { signUp, signIn, refresh, me, updateProfile, verifyEmail } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/signup", signUp);
router.get("/verify-email", verifyEmail);
router.post("/verify-email", (req, res, next) => {
  req.query = { ...req.query, token: req.body?.token };
  verifyEmail(req, res).catch(next);
});
router.post("/signin", signIn);
router.post("/refresh", refresh);
router.get("/me", requireAuth, me);
router.patch("/me", requireAuth, updateProfile);

module.exports = router;
