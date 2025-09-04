import Product from "../models/Product.js"
import Order from "../models/Order.js"
import User from "../models/User.js"

// WebSocket event handlers
export const handleWebSocketEvents = (io) => {
  io.on("connection", (socket) => {
    console.log(`User ${socket.userId} connected with role: ${socket.userRole}`)

    // Handle product stock subscription
    socket.on("subscribe_product_stock", async (data) => {
      try {
        const { productIds } = data

        if (!Array.isArray(productIds)) {
          socket.emit("error", { message: "Product IDs must be an array" })
          return
        }

        // Join rooms for each product
        productIds.forEach((productId) => {
          socket.join(`product_${productId}`)
        })

        // Send current stock status for subscribed products
        const products = await Product.find(
          { _id: { $in: productIds } },
          "name stock lowStockThreshold trackQuantity allowBackorder",
        )

        const stockData = products.map((product) => ({
          productId: product._id,
          name: product.name,
          stock: product.stock,
          isInStock: product.isInStock(),
          lowStock: product.stock <= product.lowStockThreshold,
          trackQuantity: product.trackQuantity,
          allowBackorder: product.allowBackorder,
        }))

        socket.emit("initial_stock_data", { products: stockData })

        console.log(`User ${socket.userId} subscribed to ${productIds.length} products`)
      } catch (error) {
        socket.emit("error", { message: "Failed to subscribe to product stock" })
      }
    })

    // Handle unsubscribe from product stock
    socket.on("unsubscribe_product_stock", (data) => {
      const { productIds } = data

      if (Array.isArray(productIds)) {
        productIds.forEach((productId) => {
          socket.leave(`product_${productId}`)
        })
        console.log(`User ${socket.userId} unsubscribed from ${productIds.length} products`)
      }
    })

    // Handle admin analytics subscription
    socket.on("subscribe_admin_analytics", async () => {
      if (socket.userRole !== "admin") {
        socket.emit("error", { message: "Unauthorized: Admin access required" })
        return
      }

      socket.join("admin_analytics")

      // Send initial analytics data
      try {
        const analyticsData = await getInitialAnalyticsData()
        socket.emit("initial_analytics_data", analyticsData)
        console.log(`Admin ${socket.userId} subscribed to real-time analytics`)
      } catch (error) {
        socket.emit("error", { message: "Failed to load analytics data" })
      }
    })

    // Handle unsubscribe from admin analytics
    socket.on("unsubscribe_admin_analytics", () => {
      socket.leave("admin_analytics")
      console.log(`Admin ${socket.userId} unsubscribed from analytics`)
    })

    // Handle order status subscription
    socket.on("subscribe_order_updates", () => {
      socket.join(`user_orders_${socket.userId}`)
      console.log(`User ${socket.userId} subscribed to order updates`)
    })

    // Handle unsubscribe from order updates
    socket.on("unsubscribe_order_updates", () => {
      socket.leave(`user_orders_${socket.userId}`)
      console.log(`User ${socket.userId} unsubscribed from order updates`)
    })

    // Handle admin order management subscription
    socket.on("subscribe_admin_orders", () => {
      if (socket.userRole !== "admin") {
        socket.emit("error", { message: "Unauthorized: Admin access required" })
        return
      }

      socket.join("admin_orders")
      console.log(`Admin ${socket.userId} subscribed to all order updates`)
    })

    // Handle cart synchronization (for multiple device support)
    socket.on("sync_cart", (cartData) => {
      socket.join(`user_cart_${socket.userId}`)
      socket.to(`user_cart_${socket.userId}`).emit("cart_updated", cartData)
    })

    // Handle typing indicators for customer support chat
    socket.on("typing_start", (data) => {
      socket.to(`support_${data.conversationId}`).emit("user_typing", {
        userId: socket.userId,
        isTyping: true,
      })
    })

    socket.on("typing_stop", (data) => {
      socket.to(`support_${data.conversationId}`).emit("user_typing", {
        userId: socket.userId,
        isTyping: false,
      })
    })

    // Handle disconnect
    socket.on("disconnect", (reason) => {
      console.log(`User ${socket.userId} disconnected: ${reason}`)
    })

    // Handle connection errors
    socket.on("error", (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error)
    })
  })
}

// Get initial analytics data for admin dashboard
const getInitialAnalyticsData = async () => {
  try {
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()))
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

    // Get today's stats
    const [todayOrders, todayRevenue, totalUsers, totalProducts, lowStockProducts, recentOrders, topProducts] =
      await Promise.all([
        Order.countDocuments({ createdAt: { $gte: startOfDay } }),
        Order.aggregate([
          { $match: { createdAt: { $gte: startOfDay }, paymentStatus: "paid" } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
        User.countDocuments({ role: "customer" }),
        Product.countDocuments({ isActive: true }),
        Product.find({ stock: { $lte: 10 }, trackQuantity: true }).select("name stock lowStockThreshold"),
        Order.find()
          .sort({ createdAt: -1 })
          .limit(5)
          .populate("user", "firstName lastName email")
          .select("orderNumber totalAmount orderStatus createdAt"),
        Product.find({ isActive: true }).sort({ totalSales: -1 }).limit(5).select("name totalSales price images"),
      ])

    return {
      stats: {
        todayOrders,
        todayRevenue: todayRevenue[0]?.total || 0,
        totalUsers,
        totalProducts,
        lowStockCount: lowStockProducts.length,
      },
      lowStockProducts,
      recentOrders,
      topProducts,
      timestamp: new Date(),
    }
  } catch (error) {
    console.error("Error getting analytics data:", error)
    throw error
  }
}

// Real-time event emitters
export const emitStockUpdate = (productId, stockData) => {
  const io = global.io
  if (io) {
    io.to(`product_${productId}`).emit("stock_updated", {
      productId,
      ...stockData,
      timestamp: new Date(),
    })
  }
}

export const emitOrderUpdate = (userId, orderData) => {
  const io = global.io
  if (io) {
    // Emit to specific user
    io.to(`user_orders_${userId}`).emit("order_updated", {
      ...orderData,
      timestamp: new Date(),
    })

    // Emit to admin dashboard
    io.to("admin_orders").emit("new_order_update", {
      ...orderData,
      timestamp: new Date(),
    })
  }
}

export const emitAdminAnalytics = (analyticsData) => {
  const io = global.io
  if (io) {
    io.to("admin_analytics").emit("analytics_update", {
      ...analyticsData,
      timestamp: new Date(),
    })
  }
}

export const emitLowStockAlert = (productData) => {
  const io = global.io
  if (io) {
    io.to("admin_analytics").emit("low_stock_alert", {
      ...productData,
      timestamp: new Date(),
    })
  }
}

export const emitNewUserRegistration = (userData) => {
  const io = global.io
  if (io) {
    io.to("admin_analytics").emit("new_user_registered", {
      user: userData,
      timestamp: new Date(),
    })
  }
}

export const emitCartSync = (userId, cartData) => {
  const io = global.io
  if (io) {
    io.to(`user_cart_${userId}`).emit("cart_synced", {
      cart: cartData,
      timestamp: new Date(),
    })
  }
}
