const express = require("express");
const {
  getMetrics,
  getUsage,
  listUsers,
  updateUserRole,
  updateUserStatus,
  softDeleteUser,
  listReports,
  updateReport,
  listFlagged,
  updateFloraStatus,
} = require("../controllers/adminController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth, requireRole("admin"));

router.get("/metrics", getMetrics);
router.get("/usage", getUsage);
router.get("/users", listUsers);
router.patch("/users/:id/role", updateUserRole);
router.patch("/users/:id/status", updateUserStatus);
router.delete("/users/:id", softDeleteUser);

router.get("/reports", listReports);
router.patch("/reports/:id", updateReport);

router.get("/flagged", listFlagged);
router.patch("/floras/:id/status", updateFloraStatus);

module.exports = router;
