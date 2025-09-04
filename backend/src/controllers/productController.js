import Product from "../models/Product.js"
import Category from "../models/Category.js"
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js"

// Get all products with filtering, sorting, and pagination
export const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      brand,
      minPrice,
      maxPrice,
      rating,
      search,
      sort = "-createdAt",
      featured,
      inStock,
    } = req.query

    // Build filter object
    const filter = { isActive: true }

    if (category) filter.category = category
    if (brand) filter.brand = new RegExp(brand, "i")
    if (minPrice || maxPrice) {
      filter.price = {}
      if (minPrice) filter.price.$gte = Number(minPrice)
      if (maxPrice) filter.price.$lte = Number(maxPrice)
    }
    if (rating) filter.averageRating = { $gte: Number(rating) }
    if (search) {
      filter.$text = { $search: search }
    }
    if (featured === "true") filter.isFeatured = true
    if (inStock === "true") filter.stock = { $gt: 0 }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit)

    // Use aggregation pipeline with $lookup for category details
    const pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "subcategory",
          foreignField: "_id",
          as: "subcategoryDetails",
        },
      },
      {
        $addFields: {
          category: { $arrayElemAt: ["$categoryDetails", 0] },
          subcategory: { $arrayElemAt: ["$subcategoryDetails", 0] },
        },
      },
      {
        $project: {
          categoryDetails: 0,
          subcategoryDetails: 0,
        },
      },
      { $sort: this.parseSortString(sort) },
      { $skip: skip },
      { $limit: Number(limit) },
    ]

    const products = await Product.aggregate(pipeline)
    const total = await Product.countDocuments(filter)

    res.status(200).json({
      success: true,
      data: {
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
      message: "Failed to fetch products",
      error: error.message,
    })
  }
}

// Helper function to parse sort string
const parseSortString = (sortStr) => {
  const sortObj = {}
  const sortFields = sortStr.split(",")

  sortFields.forEach((field) => {
    if (field.startsWith("-")) {
      sortObj[field.substring(1)] = -1
    } else {
      sortObj[field] = 1
    }
  })

  return sortObj
}

// Get single product by ID or slug
export const getProduct = async (req, res) => {
  try {
    const { id } = req.params
    let product

    // Check if id is a valid ObjectId or treat as slug
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      product = await Product.findById(id).populate("category subcategory", "name slug")
    } else {
      product = await Product.findOne({ slug: id }).populate("category subcategory", "name slug")
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      })
    }

    // Increment view count
    product.viewCount += 1
    await product.save()

    res.status(200).json({
      success: true,
      data: { product },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
      error: error.message,
    })
  }
}

// Create new product (Admin only)
export const createProduct = async (req, res) => {
  try {
    const productData = req.body

    // Check if category exists
    const category = await Category.findById(productData.category)
    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Invalid category",
      })
    }

    // Handle image uploads
    if (req.files && req.files.length > 0) {
      const imageUploads = await Promise.all(
        req.files.map(async (file) => {
          const result = await uploadToCloudinary(file.buffer, "products")
          return {
            public_id: result.public_id,
            url: result.secure_url,
            alt: productData.name,
          }
        }),
      )
      productData.images = imageUploads
    }

    const product = await Product.create(productData)
    await product.populate("category subcategory", "name slug")

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: { product },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create product",
      error: error.message,
    })
  }
}

// Update product (Admin only)
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    const product = await Product.findById(id)
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      })
    }

    // Handle image uploads
    if (req.files && req.files.length > 0) {
      // Delete old images from cloudinary
      if (product.images && product.images.length > 0) {
        await Promise.all(product.images.map((img) => deleteFromCloudinary(img.public_id)))
      }

      // Upload new images
      const imageUploads = await Promise.all(
        req.files.map(async (file) => {
          const result = await uploadToCloudinary(file.buffer, "products")
          return {
            public_id: result.public_id,
            url: result.secure_url,
            alt: updates.name || product.name,
          }
        }),
      )
      updates.images = imageUploads
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).populate("category subcategory", "name slug")

    // Emit stock update if stock changed
    if (updates.stock !== undefined && global.emitStockUpdate) {
      global.emitStockUpdate(id, {
        stock: updatedProduct.stock,
        isInStock: updatedProduct.isInStock(),
        lowStock: updatedProduct.stock <= updatedProduct.lowStockThreshold,
      })
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: { product: updatedProduct },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update product",
      error: error.message,
    })
  }
}

// Delete product (Admin only)
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params

    const product = await Product.findById(id)
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      })
    }

    // Delete images from cloudinary
    if (product.images && product.images.length > 0) {
      await Promise.all(product.images.map((img) => deleteFromCloudinary(img.public_id)))
    }

    await Product.findByIdAndDelete(id)

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete product",
      error: error.message,
    })
  }
}

// Add product review
export const addReview = async (req, res) => {
  try {
    const { id } = req.params
    const { rating, comment } = req.body
    const userId = req.user._id

    const product = await Product.findById(id)
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      })
    }

    // Check if user already reviewed this product
    const existingReview = product.reviews.find((review) => review.user.toString() === userId.toString())

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this product",
      })
    }

    // Add review
    product.reviews.push({
      user: userId,
      rating: Number(rating),
      comment,
    })

    // Update average rating
    product.updateRating()
    await product.save()

    res.status(201).json({
      success: true,
      message: "Review added successfully",
      data: { product },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to add review",
      error: error.message,
    })
  }
}

// Get featured products
export const getFeaturedProducts = async (req, res) => {
  try {
    const { limit = 8 } = req.query

    const products = await Product.find({ isFeatured: true, isActive: true })
      .populate("category", "name slug")
      .limit(Number(limit))
      .sort("-createdAt")

    res.status(200).json({
      success: true,
      data: { products },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch featured products",
      error: error.message,
    })
  }
}

// Get related products
export const getRelatedProducts = async (req, res) => {
  try {
    const { id } = req.params
    const { limit = 4 } = req.query

    const product = await Product.findById(id)
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      })
    }

    const relatedProducts = await Product.find({
      _id: { $ne: id },
      category: product.category,
      isActive: true,
    })
      .populate("category", "name slug")
      .limit(Number(limit))
      .sort("-averageRating")

    res.status(200).json({
      success: true,
      data: { products: relatedProducts },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch related products",
      error: error.message,
    })
  }
}
