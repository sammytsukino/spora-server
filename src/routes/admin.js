const express = require("express");
const {
  getMetrics,
  getUsage,
  getUsageCharts,
  listUsers,
  updateUserRole,
  updateUserStatus,
  softDeleteUser,
  listReports,
  getReportSignal,
  updateReport,
  listFlagged,
  listAdminFloras,
  updateFloraStatus,
  batchUpdateFloras,
  batchUpdateReports,
  batchUpdateUsers,
} = require("../controllers/adminController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth, requireRole("admin"));

router.get("/metrics", getMetrics);
router.get("/usage", getUsage);
router.get("/usage/charts", getUsageCharts);
router.get("/users", listUsers);
router.patch("/users/batch", batchUpdateUsers);
router.patch("/users/:id/role", updateUserRole);
router.patch("/users/:id/status", updateUserStatus);
router.delete("/users/:id", softDeleteUser);

router.get("/reports", listReports);
router.get("/reports/signal", getReportSignal);
router.patch("/reports/batch", batchUpdateReports);
router.patch("/reports/:id", updateReport);

router.get("/flagged", listFlagged);
router.get("/floras", listAdminFloras);
router.patch("/floras/batch", batchUpdateFloras);
router.patch("/floras/:id/status", updateFloraStatus);

module.exports = router;
