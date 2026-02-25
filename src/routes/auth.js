const express = require("express");
const { signUp, signIn, refresh, me, updateProfile } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/signup", signUp);
router.post("/signin", signIn);
router.post("/refresh", refresh);
router.get("/me", requireAuth, me);
router.patch("/me", requireAuth, updateProfile);

module.exports = router;
