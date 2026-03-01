const express = require("express");
const { follow, unfollow, getFollowingIds, checkFollowStatus } = require("../controllers/followController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/me/following", requireAuth, getFollowingIds);
router.post("/:userId", requireAuth, follow);
router.delete("/:userId", requireAuth, unfollow);
router.get("/:userId/status", requireAuth, checkFollowStatus);

module.exports = router;
