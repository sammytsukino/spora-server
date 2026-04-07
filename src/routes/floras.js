const express = require("express");
const {
  listFloras,
  getFlora,
  previewFloraScreening,
  createFlora,
  updateFlora,
  deleteFlora,
} = require("../controllers/floraController");
const { requireAuth, requireRole, optionalAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", optionalAuth, listFloras);
router.post(
  "/screen-preview",
  requireAuth,
  requireRole("cultivator", "admin"),
  previewFloraScreening
);
router.get("/:id", getFlora);
router.post("/", requireAuth, requireRole("cultivator", "admin"), createFlora);
router.patch("/:id", requireAuth, requireRole("cultivator", "admin"), updateFlora);
router.delete("/:id", requireAuth, requireRole("cultivator", "admin"), deleteFlora);

module.exports = router;
