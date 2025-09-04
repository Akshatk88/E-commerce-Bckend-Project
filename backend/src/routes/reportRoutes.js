const express = require("express")
const router = express.Router()
const {
  generateSalesReport,
  generateInventoryReport,
  generateUserReport,
  scheduleReport,
} = require("../controllers/reportController")
const { protect, authorize } = require("../middleware/authMiddleware")

/**
 * @swagger
 * /api/reports/sales:
 *   get:
 *     summary: Generate sales report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [pdf, excel, json]
 *     responses:
 *       200:
 *         description: Sales report generated successfully
 */
router.get("/sales", protect, authorize("admin"), generateSalesReport)

/**
 * @swagger
 * /api/reports/inventory:
 *   get:
 *     summary: Generate inventory report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [pdf, json]
 *       - in: query
 *         name: lowStockThreshold
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Inventory report generated successfully
 */
router.get("/inventory", protect, authorize("admin"), generateInventoryReport)

/**
 * @swagger
 * /api/reports/users:
 *   get:
 *     summary: Generate user report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [pdf, json]
 *     responses:
 *       200:
 *         description: User report generated successfully
 */
router.get("/users", protect, authorize("admin"), generateUserReport)

/**
 * @swagger
 * /api/reports/schedule:
 *   post:
 *     summary: Schedule automated report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reportType:
 *                 type: string
 *                 enum: [sales, inventory, users]
 *               frequency:
 *                 type: string
 *                 enum: [daily, weekly, monthly]
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: string
 *               format:
 *                 type: string
 *                 enum: [pdf, excel]
 *     responses:
 *       200:
 *         description: Report scheduled successfully
 */
router.post("/schedule", protect, authorize("admin"), scheduleReport)

module.exports = router
