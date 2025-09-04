import express from "express"
import { body } from "express-validator"
import {
  getDashboardStats,
  getSalesAnalytics,
  getAllUsers,
  updateUserStatus,
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getSystemHealth,
} from "../controllers/adminController.js"
import { protect, authorize } from "../middleware/authMiddleware.js"
import { validateRequest } from "../middleware/validationMiddleware.js"

const router = express.Router()

// Apply admin authorization to all routes
router.use(protect, authorize("admin"))

/**
 * @swagger
 * /api/admin/dashboard/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 */
router.get("/dashboard/stats", getDashboardStats)

/**
 * @swagger
 * /api/admin/analytics/sales:
 *   get:
 *     summary: Get sales analytics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, year]
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
 *     responses:
 *       200:
 *         description: Sales analytics retrieved successfully
 */
router.get("/analytics/sales", getSalesAnalytics)

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 */
router.get("/users", getAllUsers)

/**
 * @swagger
 * /api/admin/users/{id}/status:
 *   put:
 *     summary: Update user status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isActive:
 *                 type: boolean
 *               role:
 *                 type: string
 *                 enum: [customer, admin]
 *     responses:
 *       200:
 *         description: User status updated successfully
 */
router.put(
  "/users/:id/status",
  [
    body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
    body("role").optional().isIn(["customer", "admin"]).withMessage("Invalid role"),
  ],
  validateRequest,
  updateUserStatus,
)

/**
 * @swagger
 * /api/admin/categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 */
router.get("/categories", getAllCategories)

/**
 * @swagger
 * /api/admin/categories:
 *   post:
 *     summary: Create new category
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               parent:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               sortOrder:
 *                 type: number
 *     responses:
 *       201:
 *         description: Category created successfully
 */
router.post(
  "/categories",
  [
    body("name").trim().isLength({ min: 1, max: 100 }).withMessage("Category name is required"),
    body("description").optional().isLength({ max: 500 }).withMessage("Description too long"),
    body("parent").optional().isMongoId().withMessage("Invalid parent category ID"),
    body("sortOrder").optional().isInt({ min: 0 }).withMessage("Sort order must be a positive integer"),
  ],
  validateRequest,
  createCategory,
)

/**
 * @swagger
 * /api/admin/categories/{id}:
 *   put:
 *     summary: Update category
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category updated successfully
 */
router.put("/categories/:id", updateCategory)

/**
 * @swagger
 * /api/admin/categories/{id}:
 *   delete:
 *     summary: Delete category
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category deleted successfully
 */
router.delete("/categories/:id", deleteCategory)

/**
 * @swagger
 * /api/admin/coupons:
 *   get:
 *     summary: Get all coupons
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Coupons retrieved successfully
 */
router.get("/coupons", getAllCoupons)

/**
 * @swagger
 * /api/admin/coupons:
 *   post:
 *     summary: Create new coupon
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - name
 *               - discountType
 *               - discountValue
 *               - startDate
 *               - endDate
 *             properties:
 *               code:
 *                 type: string
 *               name:
 *                 type: string
 *               discountType:
 *                 type: string
 *                 enum: [percentage, fixed]
 *               discountValue:
 *                 type: number
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Coupon created successfully
 */
router.post(
  "/coupons",
  [
    body("code").trim().isLength({ min: 3, max: 20 }).withMessage("Coupon code must be 3-20 characters"),
    body("name").trim().isLength({ min: 1, max: 100 }).withMessage("Coupon name is required"),
    body("discountType").isIn(["percentage", "fixed"]).withMessage("Invalid discount type"),
    body("discountValue").isFloat({ min: 0 }).withMessage("Discount value must be positive"),
    body("startDate").isISO8601().withMessage("Valid start date is required"),
    body("endDate").isISO8601().withMessage("Valid end date is required"),
  ],
  validateRequest,
  createCoupon,
)

/**
 * @swagger
 * /api/admin/coupons/{id}:
 *   put:
 *     summary: Update coupon
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Coupon updated successfully
 */
router.put("/coupons/:id", updateCoupon)

/**
 * @swagger
 * /api/admin/coupons/{id}:
 *   delete:
 *     summary: Delete coupon
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Coupon deleted successfully
 */
router.delete("/coupons/:id", deleteCoupon)

/**
 * @swagger
 * /api/admin/system/health:
 *   get:
 *     summary: Get system health status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System health retrieved successfully
 */
router.get("/system/health", getSystemHealth)

export default router
