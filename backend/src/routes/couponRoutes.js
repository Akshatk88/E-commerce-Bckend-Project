import express from "express"
import { body } from "express-validator"
import { validateCoupon, getAvailableCoupons } from "../controllers/couponController.js"
import { protect } from "../middleware/authMiddleware.js"
import { validateRequest } from "../middleware/validationMiddleware.js"

const router = express.Router()

/**
 * @swagger
 * /api/coupons/validate:
 *   post:
 *     summary: Validate coupon code
 *     tags: [Coupons]
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
 *             properties:
 *               code:
 *                 type: string
 *               orderAmount:
 *                 type: number
 *               items:
 *                 type: array
 *     responses:
 *       200:
 *         description: Coupon validated successfully
 *       400:
 *         description: Invalid coupon
 *       404:
 *         description: Coupon not found
 */
router.post(
  "/validate",
  protect,
  [
    body("code").trim().isLength({ min: 1 }).withMessage("Coupon code is required"),
    body("orderAmount").optional().isFloat({ min: 0 }).withMessage("Order amount must be positive"),
  ],
  validateRequest,
  validateCoupon,
)

/**
 * @swagger
 * /api/coupons/available:
 *   get:
 *     summary: Get available coupons for user
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available coupons retrieved successfully
 */
router.get("/available", protect, getAvailableCoupons)

export default router
