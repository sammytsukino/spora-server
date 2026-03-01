const express = require("express");
const { getFollowers, getFollowing } = require("../controllers/followController");
const { getByUsername } = require("../controllers/userController");

const router = express.Router();

router.get("/by-username/:username", getByUsername);
router.get("/:id/followers", getFollowers);
router.get("/:id/following", getFollowing);

module.exports = router;
