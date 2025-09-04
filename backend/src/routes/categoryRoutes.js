import express from "express"
import { getCategories, getCategory, getCategoryTree, getCategoryProducts } from "../controllers/categoryController.js"

const router = express.Router()

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: includeProducts
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: parentOnly
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 */
router.get("/", getCategories)

/**
 * @swagger
 * /api/categories/tree:
 *   get:
 *     summary: Get category tree structure
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Category tree retrieved successfully
 */
router.get("/tree", getCategoryTree)

/**
 * @swagger
 * /api/categories/{id}:
 *   get:
 *     summary: Get single category by ID or slug
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category retrieved successfully
 *       404:
 *         description: Category not found
 */
router.get("/:id", getCategory)

/**
 * @swagger
 * /api/categories/{id}/products:
 *   get:
 *     summary: Get products by category
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category products retrieved successfully
 */
router.get("/:id/products", getCategoryProducts)

export default router
