import jwt from "jsonwebtoken"
import User from "../models/User.js"

// WebSocket authentication middleware
export const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1]

    if (!token) {
      return next(new Error("Authentication error: No token provided"))
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Get user from database
    const user = await User.findById(decoded.id).select("-password")

    if (!user) {
      return next(new Error("Authentication error: User not found"))
    }

    if (!user.isActive) {
      return next(new Error("Authentication error: User account is deactivated"))
    }

    // Add user info to socket
    socket.userId = user._id.toString()
    socket.userRole = user.role
    socket.user = user

    next()
  } catch (error) {
    console.error("Socket authentication error:", error)
    next(new Error("Authentication error: Invalid token"))
  }
}

// Rate limiting for WebSocket events
export const createSocketRateLimiter = (maxEvents = 100, windowMs = 60000) => {
  const clients = new Map()

  return (socket, next) => {
    const clientId = socket.userId || socket.id
    const now = Date.now()

    if (!clients.has(clientId)) {
      clients.set(clientId, { count: 1, resetTime: now + windowMs })
      return next()
    }

    const client = clients.get(clientId)

    if (now > client.resetTime) {
      client.count = 1
      client.resetTime = now + windowMs
      return next()
    }

    if (client.count >= maxEvents) {
      return next(new Error("Rate limit exceeded"))
    }

    client.count++
    next()
  }
}
