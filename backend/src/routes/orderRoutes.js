import express from "express"
import { body } from "express-validator"
import {
  createOrder,
  updateOrderStatus,
  updatePaymentStatus,
  getUserOrders,
  getOrder,
  getAllOrders,
} from "../controllers/orderController.js"
import { protect, authorize } from "../middleware/authMiddleware.js"
import { validateRequest } from "../middleware/validationMiddleware.js"

const router = express.Router()

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Create new order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *               - shippingAddress
 *               - billingAddress
 *               - paymentMethod
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     product:
 *                       type: string
 *                     quantity:
 *                       type: number
 *               shippingAddress:
 *                 type: object
 *               billingAddress:
 *                 type: object
 *               paymentMethod:
 *                 type: string
 *               couponCode:
 *                 type: string
 *     responses:
 *       201:
 *         description: Order created successfully
 */
router.post(
  "/",
  protect,
  [
    body("items").isArray({ min: 1 }).withMessage("At least one item is required"),
    body("items.*.product").isMongoId().withMessage("Valid product ID is required"),
    body("items.*.quantity").isInt({ min: 1 }).withMessage("Valid quantity is required"),
    body("shippingAddress").isObject().withMessage("Shipping address is required"),
    body("billingAddress").isObject().withMessage("Billing address is required"),
    body("paymentMethod")
      .isIn(["credit_card", "debit_card", "paypal", "stripe", "cash_on_delivery"])
      .withMessage("Valid payment method is required"),
  ],
  validateRequest,
  createOrder,
)

/**
 * @swagger
 * /api/orders/my-orders:
 *   get:
 *     summary: Get user orders
 *     tags: [Orders]
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
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 */
router.get("/my-orders", protect, getUserOrders)

/**
 * @swagger
 * /api/orders/admin:
 *   get:
 *     summary: Get all orders (Admin only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 */
router.get("/admin", protect, authorize("admin"), getAllOrders)

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Get single order
 *     tags: [Orders]
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
 *         description: Order retrieved successfully
 */
router.get("/:id", protect, getOrder)

/**
 * @swagger
 * /api/orders/{id}/status:
 *   put:
 *     summary: Update order status (Admin only)
 *     tags: [Orders]
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
 *             required:
 *               - orderStatus
 *             properties:
 *               orderStatus:
 *                 type: string
 *                 enum: [pending, confirmed, processing, shipped, delivered, cancelled, returned]
 *               trackingNumber:
 *                 type: string
 *               shippingCarrier:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order status updated successfully
 */
router.put(
  "/:id/status",
  protect,
  authorize("admin"),
  [
    body("orderStatus")
      .isIn(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "returned"])
      .withMessage("Valid order status is required"),
  ],
  validateRequest,
  updateOrderStatus,
)

/**
 * @swagger
 * /api/orders/{id}/payment:
 *   put:
 *     summary: Update payment status (Admin only)
 *     tags: [Orders]
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
 *             required:
 *               - paymentStatus
 *             properties:
 *               paymentStatus:
 *                 type: string
 *                 enum: [pending, paid, failed, refunded, partially_refunded]
 *               paymentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment status updated successfully
 */
router.put(
  "/:id/payment",
  protect,
  authorize("admin"),
  [
    body("paymentStatus")
      .isIn(["pending", "paid", "failed", "refunded", "partially_refunded"])
      .withMessage("Valid payment status is required"),
  ],
  validateRequest,
  updatePaymentStatus,
)

export default router
