import Order from "../models/Order.js"
import Product from "../models/Product.js"
import Coupon from "../models/Coupon.js"
import { handleNewOrder, handleOrderStatusChange, handlePaymentStatusChange } from "../utils/realtimeEvents.js"

// Create new order
export const createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, billingAddress, paymentMethod, couponCode, notes } = req.body

    // Validate items and calculate totals
    let subtotal = 0
    const orderItems = []

    for (const item of items) {
      const product = await Product.findById(item.product)

      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product not found: ${item.product}`,
        })
      }

      if (!product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product is not available: ${product.name}`,
        })
      }

      if (!product.isInStock(item.quantity)) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product: ${product.name}`,
        })
      }

      const itemTotal = product.price * item.quantity
      subtotal += itemTotal

      orderItems.push({
        product: product._id,
        name: product.name,
        image: product.images[0]?.url || "",
        price: product.price,
        quantity: item.quantity,
        variant: item.variant,
        sku: product.sku,
      })
    }

    // Apply coupon if provided
    let discountAmount = 0
    let couponData = null

    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() })

      if (!coupon || !coupon.canUserUse(req.user._id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired coupon code",
        })
      }

      discountAmount = coupon.calculateDiscount(subtotal, orderItems)
      couponData = {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      }

      // Update coupon usage
      coupon.usedCount += 1
      coupon.usageHistory.push({
        user: req.user._id,
        order: null, // Will be updated after order creation
        discountAmount,
      })
      await coupon.save()
    }

    // Calculate totals (simplified - you might want to add tax calculation)
    const taxAmount = 0 // Implement tax calculation based on your requirements
    const shippingAmount = 0 // Implement shipping calculation
    const totalAmount = subtotal + taxAmount + shippingAmount - discountAmount

    // Create order
    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      shippingAddress,
      billingAddress,
      paymentMethod,
      subtotal,
      taxAmount,
      shippingAmount,
      discountAmount,
      totalAmount,
      coupon: couponData,
      notes,
    })

    // Update coupon with order ID
    if (couponCode && couponData) {
      await Coupon.findOneAndUpdate(
        { code: couponCode.toUpperCase(), "usageHistory.order": null },
        { $set: { "usageHistory.$.order": order._id } },
      )
    }

    // Populate order with user details
    await order.populate("user", "firstName lastName email")

    // Emit real-time events
    await handleNewOrder(order)

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: { order },
    })
  } catch (error) {
    console.error("Create order error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.message,
    })
  }
}

// Update order status (Admin only)
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { orderStatus, trackingNumber, shippingCarrier, notes } = req.body

    const order = await Order.findById(id)
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      })
    }

    const oldStatus = order.orderStatus

    // Update order
    const updateData = { orderStatus }
    if (trackingNumber) updateData.trackingNumber = trackingNumber
    if (shippingCarrier) updateData.shippingCarrier = shippingCarrier
    if (notes) updateData.notes = notes

    // Set delivery date if status is delivered
    if (orderStatus === "delivered") {
      updateData.deliveredAt = new Date()
    }

    // Set cancellation date if status is cancelled
    if (orderStatus === "cancelled") {
      updateData.cancelledAt = new Date()
      if (notes) updateData.cancellationReason = notes
    }

    const updatedOrder = await Order.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate("user", "firstName lastName email")

    // Emit real-time events
    await handleOrderStatusChange(updatedOrder, oldStatus, orderStatus)

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: { order: updatedOrder },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message,
    })
  }
}

// Update payment status (Admin only)
export const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { paymentStatus, paymentId } = req.body

    const order = await Order.findById(id)
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      })
    }

    const oldPaymentStatus = order.paymentStatus

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { paymentStatus, paymentId },
      { new: true, runValidators: true },
    ).populate("user", "firstName lastName email")

    // Emit real-time events
    await handlePaymentStatusChange(updatedOrder, oldPaymentStatus, paymentStatus)

    res.status(200).json({
      success: true,
      message: "Payment status updated successfully",
      data: { order: updatedOrder },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update payment status",
      error: error.message,
    })
  }
}

// Get user orders
export const getUserOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query

    const filter = { user: req.user._id }
    if (status) filter.orderStatus = status

    const skip = (Number(page) - 1) * Number(limit)

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("items.product", "name images slug")

    const total = await Order.countDocuments(filter)

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalOrders: total,
          hasNextPage: skip + Number(limit) < total,
          hasPrevPage: Number(page) > 1,
        },
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    })
  }
}

// Get single order
export const getOrder = async (req, res) => {
  try {
    const { id } = req.params

    const order = await Order.findById(id)
      .populate("user", "firstName lastName email")
      .populate("items.product", "name images slug")

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      })
    }

    // Check if user owns the order or is admin
    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      })
    }

    res.status(200).json({
      success: true,
      data: { order },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      error: error.message,
    })
  }
}

// Get all orders (Admin only)
export const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, paymentStatus, startDate, endDate, search } = req.query

    const filter = {}
    if (status) filter.orderStatus = status
    if (paymentStatus) filter.paymentStatus = paymentStatus
    if (startDate || endDate) {
      filter.createdAt = {}
      if (startDate) filter.createdAt.$gte = new Date(startDate)
      if (endDate) filter.createdAt.$lte = new Date(endDate)
    }
    if (search) {
      filter.$or = [{ orderNumber: new RegExp(search, "i") }, { "user.email": new RegExp(search, "i") }]
    }

    const skip = (Number(page) - 1) * Number(limit)

    const orders = await Order.find(filter)
      .populate("user", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))

    const total = await Order.countDocuments(filter)

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalOrders: total,
          hasNextPage: skip + Number(limit) < total,
          hasPrevPage: Number(page) > 1,
        },
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    })
  }
}
