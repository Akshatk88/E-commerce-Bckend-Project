import Category from "../models/Category.js"
import Product from "../models/Product.js"

// Get all categories (public)
export const getCategories = async (req, res) => {
  try {
    const { includeProducts = false, parentOnly = false } = req.query

    let query = Category.find({ isActive: true })

    if (parentOnly === "true") {
      query = query.where({ parent: null })
    }

    query = query.populate("subcategories").sort({ sortOrder: 1, name: 1 })

    if (includeProducts === "true") {
      query = query.populate({
        path: "products",
        match: { isActive: true },
        select: "name slug price images averageRating",
        options: { limit: 8 },
      })
    }

    const categories = await query

    res.status(200).json({
      success: true,
      data: { categories },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: error.message,
    })
  }
}

// Get single category
export const getCategory = async (req, res) => {
  try {
    const { id } = req.params
    let category

    // Check if id is a valid ObjectId or treat as slug
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      category = await Category.findById(id)
    } else {
      category = await Category.findOne({ slug: id })
    }

    if (!category || !category.isActive) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      })
    }

    // Populate with subcategories and parent
    await category.populate("subcategories parent")

    res.status(200).json({
      success: true,
      data: { category },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch category",
      error: error.message,
    })
  }
}

// Get category tree (hierarchical structure)
export const getCategoryTree = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 })

    // Build tree structure
    const categoryMap = new Map()
    const tree = []

    // First pass: create map of all categories
    categories.forEach((category) => {
      categoryMap.set(category._id.toString(), {
        ...category.toObject(),
        children: [],
      })
    })

    // Second pass: build tree structure
    categories.forEach((category) => {
      const categoryObj = categoryMap.get(category._id.toString())

      if (category.parent) {
        const parent = categoryMap.get(category.parent.toString())
        if (parent) {
          parent.children.push(categoryObj)
        }
      } else {
        tree.push(categoryObj)
      }
    })

    res.status(200).json({
      success: true,
      data: { categories: tree },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch category tree",
      error: error.message,
    })
  }
}

// Get products by category
export const getCategoryProducts = async (req, res) => {
  try {
    const { id } = req.params
    const { page = 1, limit = 12, sort = "-createdAt", minPrice, maxPrice, brand } = req.query

    let category
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      category = await Category.findById(id)
    } else {
      category = await Category.findOne({ slug: id })
    }

    if (!category || !category.isActive) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      })
    }

    // Get all subcategory IDs
    const subcategories = await Category.find({ parent: category._id }, "_id")
    const categoryIds = [category._id, ...subcategories.map((sub) => sub._id)]

    // Build product filter
    const filter = {
      category: { $in: categoryIds },
      isActive: true,
    }

    if (minPrice || maxPrice) {
      filter.price = {}
      if (minPrice) filter.price.$gte = Number(minPrice)
      if (maxPrice) filter.price.$lte = Number(maxPrice)
    }

    if (brand) filter.brand = new RegExp(brand, "i")

    const skip = (Number(page) - 1) * Number(limit)

    // Parse sort string
    const sortObj = {}
    const sortFields = sort.split(",")
    sortFields.forEach((field) => {
      if (field.startsWith("-")) {
        sortObj[field.substring(1)] = -1
      } else {
        sortObj[field] = 1
      }
    })

    const products = await Product.find(filter)
      .populate("category", "name slug")
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit))

    const total = await Product.countDocuments(filter)

    res.status(200).json({
      success: true,
      data: {
        category,
        products,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalProducts: total,
          hasNextPage: skip + Number(limit) < total,
          hasPrevPage: Number(page) > 1,
        },
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch category products",
      error: error.message,
    })
  }
}
