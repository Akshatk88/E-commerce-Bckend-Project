import express from "express"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"
import compression from "compression"
import mongoSanitize from "express-mongo-sanitize"
import xss from "xss-clean"
import rateLimit from "express-rate-limit"
import { createServer } from "http"
import { Server } from "socket.io"
import dotenv from "dotenv"

import connectDB from "./config/database.js"
import { errorHandler, notFound } from "./middleware/errorMiddleware.js"
import { setupSwagger } from "./config/swagger.js"
import { setupSocketIO } from "./config/socket.js"
import { startScheduledTasks } from "./utils/scheduler.js"

// Import routes
import authRoutes from "./routes/authRoutes.js"
import userRoutes from "./routes/userRoutes.js"
import productRoutes from "./routes/productRoutes.js"
import categoryRoutes from "./routes/categoryRoutes.js"
import orderRoutes from "./routes/orderRoutes.js"
import couponRoutes from "./routes/couponRoutes.js"
import reportRoutes from "./routes/reportRoutes.js"
import analyticsRoutes from "./routes/analyticsRoutes.js"
import adminRoutes from "./routes/adminRoutes.js"

// Load environment variables
dotenv.config()

// Connect to MongoDB
connectDB()

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
})

// Security middleware
app.use(helmet())
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
)

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
})
app.use("/api/", limiter)

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Data sanitization
app.use(mongoSanitize())
app.use(xss())

// Compression middleware
app.use(compression())

// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"))
}

// Setup Socket.IO
setupSocketIO(io)

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io
  next()
})

// Setup Swagger documentation
setupSwagger(app)

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// API routes
app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/products", productRoutes)
app.use("/api/categories", categoryRoutes)
app.use("/api/orders", orderRoutes)
app.use("/api/coupons", couponRoutes)
app.use("/api/reports", reportRoutes)
app.use("/api/analytics", analyticsRoutes)
app.use("/api/admin", adminRoutes)

// Error handling middleware
app.use(notFound)
app.use(errorHandler)

// Start scheduled tasks
startScheduledTasks()

const PORT = process.env.PORT || 5000

server.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
  console.log(`📚 API Documentation available at http://localhost:${PORT}/api-docs`)
})

export default app
