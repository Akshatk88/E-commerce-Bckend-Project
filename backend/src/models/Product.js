import mongoose from "mongoose"

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      maxlength: [500, "Review comment cannot exceed 500 characters"],
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
)

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [200, "Product name cannot exceed 200 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    shortDescription: {
      type: String,
      maxlength: [500, "Short description cannot exceed 500 characters"],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Product category is required"],
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    brand: {
      type: String,
      trim: true,
      maxlength: [100, "Brand name cannot exceed 100 characters"],
    },
    sku: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
      uppercase: true,
    },
    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"],
    },
    comparePrice: {
      type: Number,
      min: [0, "Compare price cannot be negative"],
    },
    costPrice: {
      type: Number,
      min: [0, "Cost price cannot be negative"],
    },
    stock: {
      type: Number,
      required: [true, "Stock quantity is required"],
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
    },
    trackQuantity: {
      type: Boolean,
      default: true,
    },
    allowBackorder: {
      type: Boolean,
      default: false,
    },
    images: [
      {
        public_id: String,
        url: String,
        alt: String,
      },
    ],
    variants: [
      {
        name: String, // e.g., "Size", "Color"
        value: String, // e.g., "Large", "Red"
        price: Number,
        stock: Number,
        sku: String,
        image: {
          public_id: String,
          url: String,
        },
      },
    ],
    attributes: [
      {
        name: String,
        value: String,
      },
    ],
    tags: [String],
    weight: {
      value: Number,
      unit: {
        type: String,
        enum: ["kg", "g", "lb", "oz"],
        default: "kg",
      },
    },
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
      unit: {
        type: String,
        enum: ["cm", "m", "in", "ft"],
        default: "cm",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isDigital: {
      type: Boolean,
      default: false,
    },
    requiresShipping: {
      type: Boolean,
      default: true,
    },
    taxable: {
      type: Boolean,
      default: true,
    },
    taxClass: {
      type: String,
      default: "standard",
    },
    reviews: [reviewSchema],
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    totalSales: {
      type: Number,
      default: 0,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    seoTitle: String,
    seoDescription: String,
    seoKeywords: [String],
    publishedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

// Indexes for better query performance
productSchema.index({ name: "text", description: "text", tags: "text" })
productSchema.index({ category: 1 })
productSchema.index({ subcategory: 1 })
productSchema.index({ brand: 1 })
productSchema.index({ sku: 1 })
productSchema.index({ price: 1 })
productSchema.index({ stock: 1 })
productSchema.index({ isActive: 1 })
productSchema.index({ isFeatured: 1 })
productSchema.index({ averageRating: -1 })
productSchema.index({ totalSales: -1 })
productSchema.index({ createdAt: -1 })

// Generate slug before saving
productSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
  }
  next()
})

// Update average rating when reviews change
productSchema.methods.updateRating = function () {
  if (this.reviews.length === 0) {
    this.averageRating = 0
    this.totalReviews = 0
  } else {
    const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0)
    this.averageRating = Math.round((totalRating / this.reviews.length) * 10) / 10
    this.totalReviews = this.reviews.length
  }
}

// Check if product is in stock
productSchema.methods.isInStock = function (quantity = 1) {
  if (!this.trackQuantity) return true
  if (this.allowBackorder) return true
  return this.stock >= quantity
}

// Virtual for discount percentage
productSchema.virtual("discountPercentage").get(function () {
  if (this.comparePrice && this.comparePrice > this.price) {
    return Math.round(((this.comparePrice - this.price) / this.comparePrice) * 100)
  }
  return 0
})

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       required:
 *         - name
 *         - description
 *         - category
 *         - sku
 *         - price
 *         - stock
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *           maxLength: 200
 *         slug:
 *           type: string
 *         description:
 *           type: string
 *           maxLength: 2000
 *         shortDescription:
 *           type: string
 *           maxLength: 500
 *         category:
 *           type: string
 *           description: Category ID
 *         subcategory:
 *           type: string
 *           description: Subcategory ID
 *         brand:
 *           type: string
 *           maxLength: 100
 *         sku:
 *           type: string
 *         price:
 *           type: number
 *           minimum: 0
 *         comparePrice:
 *           type: number
 *           minimum: 0
 *         stock:
 *           type: number
 *           minimum: 0
 *         images:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               public_id:
 *                 type: string
 *               url:
 *                 type: string
 *               alt:
 *                 type: string
 *         isActive:
 *           type: boolean
 *           default: true
 *         isFeatured:
 *           type: boolean
 *           default: false
 *         averageRating:
 *           type: number
 *           minimum: 0
 *           maximum: 5
 *         totalReviews:
 *           type: number
 *         totalSales:
 *           type: number
 */

export default mongoose.model("Product", productSchema)
