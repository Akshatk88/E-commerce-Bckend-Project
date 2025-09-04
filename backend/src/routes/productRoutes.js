import express from "express"
import { body } from "express-validator"
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  addReview,
  getFeaturedProducts,
  getRelatedProducts,
} from "../controllers/productController.js"
import { protect, authorize } from "../middleware/authMiddleware.js"
import { validateRequest } from "../middleware/validationMiddleware.js"
import { upload } from "../middleware/uploadMiddleware.js"

const router = express.Router()

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products with filtering and pagination
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 12
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 */
router.get("/", getProducts)

/**
 * @swagger
 * /api/products/featured:
 *   get:
 *     summary: Get featured products
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Featured products retrieved successfully
 */
router.get("/featured", getFeaturedProducts)

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get single product by ID or slug
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product retrieved successfully
 *       404:
 *         description: Product not found
 */
router.get("/:id", getProduct)

/**
 * @swagger
 * /api/products/{id}/related:
 *   get:
 *     summary: Get related products
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Related products retrieved successfully
 */
router.get("/:id/related", getRelatedProducts)

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create new product (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - category
 *               - sku
 *               - price
 *               - stock
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               sku:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: number
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Product created successfully
 */
router.post(
  "/",
  protect,
  authorize("admin"),
  upload.array("images", 5),
  [
    body("name").trim().isLength({ min: 1, max: 200 }).withMessage("Product name is required"),
    body("description").trim().isLength({ min: 1, max: 2000 }).withMessage("Description is required"),
    body("category").isMongoId().withMessage("Valid category ID is required"),
    body("sku").trim().isLength({ min: 1 }).withMessage("SKU is required"),
    body("price").isFloat({ min: 0 }).withMessage("Valid price is required"),
    body("stock").isInt({ min: 0 }).withMessage("Valid stock quantity is required"),
  ],
  validateRequest,
  createProduct,
)

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Update product (Admin only)
 *     tags: [Products]
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
 *         description: Product updated successfully
 */
router.put("/:id", protect, authorize("admin"), upload.array("images", 5), updateProduct)

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete product (Admin only)
 *     tags: [Products]
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
 *         description: Product deleted successfully
 */
router.delete("/:id", protect, authorize("admin"), deleteProduct)

/**
 * @swagger
 * /api/products/{id}/reviews:
 *   post:
 *     summary: Add product review
 *     tags: [Products]
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
 *               - rating
 *               - comment
 *             properties:
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *     responses:
 *       201:
 *         description: Review added successfully
 */
router.post(
  "/:id/reviews",
  protect,
  [
    body("rating").isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5"),
    body("comment").trim().isLength({ min: 1, max: 500 }).withMessage("Comment is required"),
  ],
  validateRequest,
  addReview,
)

export default router
