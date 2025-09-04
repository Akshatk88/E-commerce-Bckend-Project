import mongoose from "mongoose"

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      unique: true,
      trim: true,
      maxlength: [100, "Category name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    image: {
      public_id: String,
      url: String,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    seoTitle: String,
    seoDescription: String,
    seoKeywords: [String],
  },
  {
    timestamps: true,
  },
)

// Index for better query performance
categorySchema.index({ name: 1 })
categorySchema.index({ slug: 1 })
categorySchema.index({ parent: 1 })
categorySchema.index({ isActive: 1 })

// Generate slug before saving
categorySchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
  }
  next()
})

// Virtual for subcategories
categorySchema.virtual("subcategories", {
  ref: "Category",
  localField: "_id",
  foreignField: "parent",
})

// Virtual for products count
categorySchema.virtual("productsCount", {
  ref: "Product",
  localField: "_id",
  foreignField: "category",
  count: true,
})

/**
 * @swagger
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *           maxLength: 100
 *         slug:
 *           type: string
 *         description:
 *           type: string
 *           maxLength: 500
 *         image:
 *           type: object
 *           properties:
 *             public_id:
 *               type: string
 *             url:
 *               type: string
 *         parent:
 *           type: string
 *           description: Parent category ID
 *         isActive:
 *           type: boolean
 *           default: true
 *         sortOrder:
 *           type: number
 *           default: 0
 *         seoTitle:
 *           type: string
 *         seoDescription:
 *           type: string
 *         seoKeywords:
 *           type: array
 *           items:
 *             type: string
 */

export default mongoose.model("Category", categorySchema)
