import jwt from "jsonwebtoken"

export const setupSocketIO = (io) => {
  // Socket authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token

    if (!token) {
      return next(new Error("Authentication error"))
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      socket.userId = decoded.id
      socket.userRole = decoded.role
      next()
    } catch (err) {
      next(new Error("Authentication error"))
    }
  })

  io.on("connection", (socket) => {
    console.log(`👤 User ${socket.userId} connected`)

    // Join user to their personal room
    socket.join(`user_${socket.userId}`)

    // Join admin users to admin room
    if (socket.userRole === "admin") {
      socket.join("admin_room")
    }

    // Handle product stock subscription
    socket.on("subscribe_product_stock", (productId) => {
      socket.join(`product_${productId}`)
      console.log(`📦 User ${socket.userId} subscribed to product ${productId} stock updates`)
    })

    // Handle unsubscribe from product stock
    socket.on("unsubscribe_product_stock", (productId) => {
      socket.leave(`product_${productId}`)
      console.log(`📦 User ${socket.userId} unsubscribed from product ${productId} stock updates`)
    })

    // Handle admin dashboard subscription
    socket.on("subscribe_admin_analytics", () => {
      if (socket.userRole === "admin") {
        socket.join("admin_analytics")
        console.log(`📊 Admin ${socket.userId} subscribed to real-time analytics`)
      }
    })

    socket.on("disconnect", () => {
      console.log(`👋 User ${socket.userId} disconnected`)
    })
  })

  // Helper functions for emitting events
  global.emitStockUpdate = (productId, stockData) => {
    io.to(`product_${productId}`).emit("stock_updated", {
      productId,
      ...stockData,
    })
  }

  global.emitAdminAnalytics = (analyticsData) => {
    io.to("admin_analytics").emit("analytics_update", analyticsData)
  }

  global.emitOrderUpdate = (userId, orderData) => {
    io.to(`user_${userId}`).emit("order_update", orderData)
  }
}
