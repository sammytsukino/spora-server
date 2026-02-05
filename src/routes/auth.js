const express = require("express");
const { signUp, signIn, me } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/signup", signUp);
router.post("/signin", signIn);
router.get("/me", requireAuth, me);

module.exports = router;
