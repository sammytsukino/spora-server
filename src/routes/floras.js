const express = require("express");
const {
  listFloras,
  getFlora,
  createFlora,
  updateFlora,
  deleteFlora,
} = require("../controllers/floraController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", listFloras);
router.get("/:id", getFlora);
router.post("/", requireAuth, requireRole("cultivator", "admin"), createFlora);
router.patch("/:id", requireAuth, requireRole("cultivator", "admin"), updateFlora);
router.delete("/:id", requireAuth, requireRole("cultivator", "admin"), deleteFlora);

module.exports = router;
