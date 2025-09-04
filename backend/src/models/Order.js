import mongoose from "mongoose"

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  image: String,
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  variant: {
    name: String,
    value: String,
  },
  sku: String,
})

const shippingAddressSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  company: String,
  address1: {
    type: String,
    required: true,
  },
  address2: String,
  city: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  zipCode: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
  },
  phone: String,
})

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [orderItemSchema],
    shippingAddress: {
      type: shippingAddressSchema,
      required: true,
    },
    billingAddress: {
      type: shippingAddressSchema,
      required: true,
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ["credit_card", "debit_card", "paypal", "stripe", "cash_on_delivery"],
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "partially_refunded"],
      default: "pending",
    },
    paymentId: String, // Payment gateway transaction ID
    orderStatus: {
      type: String,
      enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "returned"],
      default: "pending",
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    shippingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    coupon: {
      code: String,
      discountType: {
        type: String,
        enum: ["percentage", "fixed"],
      },
      discountValue: Number,
    },
    currency: {
      type: String,
      default: "USD",
    },
    notes: String,
    trackingNumber: String,
    shippingCarrier: String,
    estimatedDelivery: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    cancellationReason: String,
    refundAmount: {
      type: Number,
      default: 0,
    },
    refundReason: String,
    statusHistory: [
      {
        status: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        note: String,
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
  },
  {
    timestamps: true,
  },
)

// Indexes
orderSchema.index({ orderNumber: 1 })
orderSchema.index({ user: 1 })
orderSchema.index({ orderStatus: 1 })
orderSchema.index({ paymentStatus: 1 })
orderSchema.index({ createdAt: -1 })
orderSchema.index({ "items.product": 1 })

// Generate order number before saving
orderSchema.pre("save", async function (next) {
  if (this.isNew) {
    const count = await mongoose.model("Order").countDocuments()
    this.orderNumber = `ORD-${Date.now()}-${(count + 1).toString().padStart(4, "0")}`
  }
  next()
})

// Add status to history when status changes
orderSchema.pre("save", function (next) {
  if (this.isModified("orderStatus") && !this.isNew) {
    this.statusHistory.push({
      status: this.orderStatus,
      timestamp: new Date(),
      note: `Order status changed to ${this.orderStatus}`,
    })
  }
  next()
})

// Virtual for total items
orderSchema.virtual("totalItems").get(function () {
  return this.items.reduce((total, item) => total + item.quantity, 0)
})

/**
 * @swagger
 * components:
 *   schemas:
 *     Order:
 *       type: object
 *       required:
 *         - user
 *         - items
 *         - shippingAddress
 *         - billingAddress
 *         - paymentMethod
 *         - subtotal
 *         - totalAmount
 *       properties:
 *         _id:
 *           type: string
 *         orderNumber:
 *           type: string
 *         user:
 *           type: string
 *           description: User ID
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               product:
 *                 type: string
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               quantity:
 *                 type: number
 *         paymentMethod:
 *           type: string
 *           enum: [credit_card, debit_card, paypal, stripe, cash_on_delivery]
 *         paymentStatus:
 *           type: string
 *           enum: [pending, paid, failed, refunded, partially_refunded]
 *         orderStatus:
 *           type: string
 *           enum: [pending, confirmed, processing, shipped, delivered, cancelled, returned]
 *         subtotal:
 *           type: number
 *         totalAmount:
 *           type: number
 */

export default mongoose.model("Order", orderSchema)
