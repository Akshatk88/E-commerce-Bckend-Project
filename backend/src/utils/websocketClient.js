"use client"

import { io } from "socket.io-client"
import { useState, useEffect } from "react"

// Client-side WebSocket utility (for frontend integration)
export const createWebSocketClient = (token, serverUrl = "http://localhost:5000") => {
  const socket = io(serverUrl, {
    auth: {
      token: token,
    },
    transports: ["websocket", "polling"],
  })

  // Connection event handlers
  socket.on("connect", () => {
    console.log("Connected to server")
  })

  socket.on("disconnect", (reason) => {
    console.log("Disconnected from server:", reason)
  })

  socket.on("error", (error) => {
    console.error("Socket error:", error)
  })

  // Stock update handlers
  const subscribeToProductStock = (productIds) => {
    socket.emit("subscribe_product_stock", { productIds })
  }

  const unsubscribeFromProductStock = (productIds) => {
    socket.emit("unsubscribe_product_stock", { productIds })
  }

  // Order update handlers
  const subscribeToOrderUpdates = () => {
    socket.emit("subscribe_order_updates")
  }

  const unsubscribeFromOrderUpdates = () => {
    socket.emit("unsubscribe_order_updates")
  }

  // Admin analytics handlers
  const subscribeToAdminAnalytics = () => {
    socket.emit("subscribe_admin_analytics")
  }

  const unsubscribeFromAdminAnalytics = () => {
    socket.emit("unsubscribe_admin_analytics")
  }

  // Cart synchronization
  const syncCart = (cartData) => {
    socket.emit("sync_cart", cartData)
  }

  // Event listeners
  const onStockUpdate = (callback) => {
    socket.on("stock_updated", callback)
  }

  const onOrderUpdate = (callback) => {
    socket.on("order_updated", callback)
  }

  const onAnalyticsUpdate = (callback) => {
    socket.on("analytics_update", callback)
  }

  const onLowStockAlert = (callback) => {
    socket.on("low_stock_alert", callback)
  }

  const onCartSync = (callback) => {
    socket.on("cart_synced", callback)
  }

  const onInitialStockData = (callback) => {
    socket.on("initial_stock_data", callback)
  }

  const onInitialAnalyticsData = (callback) => {
    socket.on("initial_analytics_data", callback)
  }

  // Cleanup function
  const disconnect = () => {
    socket.disconnect()
  }

  return {
    socket,
    subscribeToProductStock,
    unsubscribeFromProductStock,
    subscribeToOrderUpdates,
    unsubscribeFromOrderUpdates,
    subscribeToAdminAnalytics,
    unsubscribeFromAdminAnalytics,
    syncCart,
    onStockUpdate,
    onOrderUpdate,
    onAnalyticsUpdate,
    onLowStockAlert,
    onCartSync,
    onInitialStockData,
    onInitialAnalyticsData,
    disconnect,
  }
}

// React hook for WebSocket (example implementation)
export const useWebSocket = (token) => {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (token) {
      const ws = createWebSocketClient(token)
      setSocket(ws)

      ws.socket.on("connect", () => setIsConnected(true))
      ws.socket.on("disconnect", () => setIsConnected(false))

      return () => {
        ws.disconnect()
      }
    }
  }, [token])

  return { socket, isConnected }
}
