const express = require("express")
const router = express.Router()
const { getDashboardAnalytics, getRealTimeMetrics } = require("../controllers/analyticsController")
const { protect, authorize } = require("../middleware/authMiddleware")

/**
 * @swagger
 * /api/analytics/dashboard:
 *   get:
 *     summary: Get dashboard analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *     responses:
 *       200:
 *         description: Dashboard analytics retrieved successfully
 */
router.get("/dashboard", protect, authorize("admin"), getDashboardAnalytics)

/**
 * @swagger
 * /api/analytics/realtime:
 *   get:
 *     summary: Get real-time metrics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Real-time metrics retrieved successfully
 */
router.get("/realtime", protect, authorize("admin"), getRealTimeMetrics)

module.exports = router
