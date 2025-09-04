import mongoose from "mongoose"

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [3, "Coupon code must be at least 3 characters"],
      maxlength: [20, "Coupon code cannot exceed 20 characters"],
    },
    name: {
      type: String,
      required: [true, "Coupon name is required"],
      trim: true,
      maxlength: [100, "Coupon name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    discountType: {
      type: String,
      required: [true, "Discount type is required"],
      enum: ["percentage", "fixed"],
    },
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount value cannot be negative"],
    },
    minimumOrderAmount: {
      type: Number,
      default: 0,
      min: [0, "Minimum order amount cannot be negative"],
    },
    maximumDiscountAmount: {
      type: Number,
      min: [0, "Maximum discount amount cannot be negative"],
    },
    usageLimit: {
      type: Number,
      min: [1, "Usage limit must be at least 1"],
    },
    usageLimitPerUser: {
      type: Number,
      min: [1, "Usage limit per user must be at least 1"],
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    applicableCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    excludedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    excludedCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    applicableUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    firstTimeCustomersOnly: {
      type: Boolean,
      default: false,
    },
    usageHistory: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        order: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
          required: true,
        },
        discountAmount: {
          type: Number,
          required: true,
        },
        usedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

// Indexes
couponSchema.index({ code: 1 })
couponSchema.index({ isActive: 1 })
couponSchema.index({ startDate: 1, endDate: 1 })
couponSchema.index({ createdBy: 1 })

// Validation: End date must be after start date
couponSchema.pre("save", function (next) {
  if (this.endDate <= this.startDate) {
    next(new Error("End date must be after start date"))
  }
  next()
})

// Check if coupon is valid
couponSchema.methods.isValid = function () {
  const now = new Date()
  return (
    this.isActive &&
    this.startDate <= now &&
    this.endDate >= now &&
    (!this.usageLimit || this.usedCount < this.usageLimit)
  )
}

// Check if user can use this coupon
couponSchema.methods.canUserUse = function (userId) {
  // Check if coupon is valid
  if (!this.isValid()) return false

  // Check if user-specific coupon
  if (this.applicableUsers.length > 0 && !this.applicableUsers.includes(userId)) {
    return false
  }

  // Check usage limit per user
  if (this.usageLimitPerUser) {
    const userUsageCount = this.usageHistory.filter((usage) => usage.user.toString() === userId.toString()).length
    if (userUsageCount >= this.usageLimitPerUser) {
      return false
    }
  }

  return true
}

// Calculate discount amount
couponSchema.methods.calculateDiscount = function (orderAmount, items = []) {
  if (!this.isValid()) return 0

  let applicableAmount = orderAmount

  // If specific products/categories are set, calculate applicable amount
  if (this.applicableProducts.length > 0 || this.applicableCategories.length > 0) {
    applicableAmount = 0
    // This would need to be calculated based on the items in the order
    // For now, we'll use the full order amount
  }

  // Check minimum order amount
  if (applicableAmount < this.minimumOrderAmount) return 0

  let discountAmount = 0

  if (this.discountType === "percentage") {
    discountAmount = (applicableAmount * this.discountValue) / 100
  } else {
    discountAmount = this.discountValue
  }

  // Apply maximum discount limit
  if (this.maximumDiscountAmount && discountAmount > this.maximumDiscountAmount) {
    discountAmount = this.maximumDiscountAmount
  }

  // Ensure discount doesn't exceed order amount
  return Math.min(discountAmount, applicableAmount)
}

/**
 * @swagger
 * components:
 *   schemas:
 *     Coupon:
 *       type: object
 *       required:
 *         - code
 *         - name
 *         - discountType
 *         - discountValue
 *         - startDate
 *         - endDate
 *         - createdBy
 *       properties:
 *         _id:
 *           type: string
 *         code:
 *           type: string
 *           minLength: 3
 *           maxLength: 20
 *         name:
 *           type: string
 *           maxLength: 100
 *         description:
 *           type: string
 *           maxLength: 500
 *         discountType:
 *           type: string
 *           enum: [percentage, fixed]
 *         discountValue:
 *           type: number
 *           minimum: 0
 *         minimumOrderAmount:
 *           type: number
 *           minimum: 0
 *         maximumDiscountAmount:
 *           type: number
 *           minimum: 0
 *         usageLimit:
 *           type: number
 *           minimum: 1
 *         usageLimitPerUser:
 *           type: number
 *           minimum: 1
 *         isActive:
 *           type: boolean
 *           default: true
 *         startDate:
 *           type: string
 *           format: date-time
 *         endDate:
 *           type: string
 *           format: date-time
 */

export default mongoose.model("Coupon", couponSchema)
