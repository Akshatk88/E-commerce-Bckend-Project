import {
  emitStockUpdate,
  emitOrderUpdate,
  emitAdminAnalytics,
  emitLowStockAlert,
} from "../controllers/websocketController.js"
import Product from "../models/Product.js" // Declare the Product variable

// Stock management events
export const handleStockChange = async (productId, oldStock, newStock, product) => {
  const stockData = {
    stock: newStock,
    previousStock: oldStock,
    isInStock: product.isInStock(),
    lowStock: newStock <= product.lowStockThreshold,
    stockChange: newStock - oldStock,
  }

  // Emit stock update to subscribers
  emitStockUpdate(productId, stockData)

  // Check for low stock alert
  if (newStock <= product.lowStockThreshold && oldStock > product.lowStockThreshold) {
    emitLowStockAlert({
      productId,
      name: product.name,
      stock: newStock,
      threshold: product.lowStockThreshold,
    })
  }

  // Update admin analytics
  emitAdminAnalytics({
    type: "stock_update",
    productId,
    stockData,
  })
}

// Order management events
export const handleOrderStatusChange = async (order, oldStatus, newStatus) => {
  const orderData = {
    orderId: order._id,
    orderNumber: order.orderNumber,
    oldStatus,
    newStatus,
    totalAmount: order.totalAmount,
    user: order.user,
  }

  // Emit to user
  emitOrderUpdate(order.user, orderData)

  // Update admin analytics
  emitAdminAnalytics({
    type: "order_status_change",
    orderData,
  })
}

// New order events
export const handleNewOrder = async (order) => {
  const orderData = {
    orderId: order._id,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    itemCount: order.items.length,
    user: order.user,
    status: order.orderStatus,
  }

  // Update admin analytics
  emitAdminAnalytics({
    type: "new_order",
    orderData,
  })

  // Update stock for ordered items
  for (const item of order.items) {
    const product = await Product.findById(item.product)
    if (product && product.trackQuantity) {
      const oldStock = product.stock
      product.stock -= item.quantity
      product.totalSales += item.quantity
      await product.save()

      // Emit stock update
      await handleStockChange(item.product, oldStock, product.stock, product)
    }
  }
}

// Payment events
export const handlePaymentStatusChange = async (order, oldStatus, newStatus) => {
  const paymentData = {
    orderId: order._id,
    orderNumber: order.orderNumber,
    oldPaymentStatus: oldStatus,
    newPaymentStatus: newStatus,
    totalAmount: order.totalAmount,
  }

  // Emit to user
  emitOrderUpdate(order.user, {
    type: "payment_update",
    ...paymentData,
  })

  // Update admin analytics
  emitAdminAnalytics({
    type: "payment_status_change",
    paymentData,
  })
}

// User activity events
export const handleUserActivity = (userId, activity) => {
  emitAdminAnalytics({
    type: "user_activity",
    userId,
    activity,
    timestamp: new Date(),
  })
}

// Product view events
export const handleProductView = (productId, userId) => {
  emitAdminAnalytics({
    type: "product_view",
    productId,
    userId,
    timestamp: new Date(),
  })
}
