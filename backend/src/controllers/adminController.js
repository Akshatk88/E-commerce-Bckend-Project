import User from "../models/User.js"
import Product from "../models/Product.js"
import Category from "../models/Category.js"
import Order from "../models/Order.js"
import Coupon from "../models/Coupon.js"

// Dashboard Overview Statistics
export const getDashboardStats = async (req, res) => {
  try {
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()))
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const startOfYear = new Date(today.getFullYear(), 0, 1)

    // Parallel queries for better performance
    const [
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      todayOrders,
      todayRevenue,
      weeklyOrders,
      weeklyRevenue,
      monthlyOrders,
      monthlyRevenue,
      pendingOrders,
      lowStockProducts,
      topSellingProducts,
      recentOrders,
      userGrowth,
      orderStatusDistribution,
      paymentStatusDistribution,
    ] = await Promise.all([
      // Total counts
      User.countDocuments({ role: "customer" }),
      Product.countDocuments({ isActive: true }),
      Order.countDocuments(),
      Order.aggregate([
        { $match: { paymentStatus: "paid" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),

      // Today's stats
      Order.countDocuments({ createdAt: { $gte: startOfDay } }),
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfDay }, paymentStatus: "paid" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),

      // Weekly stats
      Order.countDocuments({ createdAt: { $gte: startOfWeek } }),
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfWeek }, paymentStatus: "paid" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),

      // Monthly stats
      Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfMonth }, paymentStatus: "paid" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),

      // Pending orders
      Order.countDocuments({ orderStatus: "pending" }),

      // Low stock products
      Product.find({ stock: { $lte: 10 }, trackQuantity: true }).select("name stock lowStockThreshold sku"),

      // Top selling products
      Product.find({ isActive: true })
        .sort({ totalSales: -1 })
        .limit(5)
        .select("name totalSales price images"),

      // Recent orders
      Order.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("user", "firstName lastName email")
        .select("orderNumber totalAmount orderStatus paymentStatus createdAt"),

      // User growth (last 12 months)
      User.aggregate([
        {
          $match: {
            role: "customer",
            createdAt: { $gte: startOfYear },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      // Order status distribution
      Order.aggregate([
        {
          $group: {
            _id: "$orderStatus",
            count: { $sum: 1 },
          },
        },
      ]),

      // Payment status distribution
      Order.aggregate([
        {
          $group: {
            _id: "$paymentStatus",
            count: { $sum: 1 },
          },
        },
      ]),
    ])

    // Calculate growth percentages (simplified)
    const yesterdayStart = new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000)
    const yesterdayOrders = await Order.countDocuments({
      createdAt: { $gte: yesterdayStart, $lt: startOfDay },
    })

    const orderGrowth = yesterdayOrders > 0 ? ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100 : 0

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalProducts,
          totalOrders,
          totalRevenue: totalRevenue[0]?.total || 0,
          pendingOrders,
          lowStockCount: lowStockProducts.length,
        },
        today: {
          orders: todayOrders,
          revenue: todayRevenue[0]?.total || 0,
          orderGrowth: Math.round(orderGrowth * 100) / 100,
        },
        weekly: {
          orders: weeklyOrders,
          revenue: weeklyRevenue[0]?.total || 0,
        },
        monthly: {
          orders: monthlyOrders,
          revenue: monthlyRevenue[0]?.total || 0,
        },
        lowStockProducts,
        topSellingProducts,
        recentOrders,
        userGrowth,
        orderStatusDistribution,
        paymentStatusDistribution,
        timestamp: new Date(),
      },
    })
  } catch (error) {
    console.error("Dashboard stats error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
      error: error.message,
    })
  }
}

// Sales Analytics
export const getSalesAnalytics = async (req, res) => {
  try {
    const { period = "month", startDate, endDate } = req.query

    let dateFilter = {}
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      }
    } else {
      // Default periods
      const now = new Date()
      switch (period) {
        case "week":
          dateFilter.createdAt = { $gte: new Date(now.setDate(now.getDate() - 7)) }
          break
        case "month":
          dateFilter.createdAt = { $gte: new Date(now.setMonth(now.getMonth() - 1)) }
          break
        case "year":
          dateFilter.createdAt = { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) }
          break
      }
    }

    const [salesByDay, salesByCategory, salesByProduct, revenueByPaymentMethod] = await Promise.all([
      // Sales by day
      Order.aggregate([
        { $match: { ...dateFilter, paymentStatus: "paid" } },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" },
            },
            totalSales: { $sum: "$totalAmount" },
            orderCount: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      ]),

      // Sales by category
      Order.aggregate([
        { $match: { ...dateFilter, paymentStatus: "paid" } },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.product",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $lookup: {
            from: "categories",
            localField: "product.category",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: "$category" },
        {
          $group: {
            _id: "$category.name",
            totalSales: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
            totalQuantity: { $sum: "$items.quantity" },
          },
        },
        { $sort: { totalSales: -1 } },
      ]),

      // Top selling products
      Order.aggregate([
        { $match: { ...dateFilter, paymentStatus: "paid" } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.product",
            productName: { $first: "$items.name" },
            totalSales: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
            totalQuantity: { $sum: "$items.quantity" },
          },
        },
        { $sort: { totalSales: -1 } },
        { $limit: 10 },
      ]),

      // Revenue by payment method
      Order.aggregate([
        { $match: { ...dateFilter, paymentStatus: "paid" } },
        {
          $group: {
            _id: "$paymentMethod",
            totalRevenue: { $sum: "$totalAmount" },
            orderCount: { $sum: 1 },
          },
        },
        { $sort: { totalRevenue: -1 } },
      ]),
    ])

    res.status(200).json({
      success: true,
      data: {
        salesByDay,
        salesByCategory,
        salesByProduct,
        revenueByPaymentMethod,
        period,
        dateRange: dateFilter,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales analytics",
      error: error.message,
    })
  }
}

// User Management
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search, isActive } = req.query

    const filter = {}
    if (role) filter.role = role
    if (isActive !== undefined) filter.isActive = isActive === "true"
    if (search) {
      filter.$or = [
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
      ]
    }

    const skip = (Number(page) - 1) * Number(limit)

    const users = await User.find(filter).select("-password").sort({ createdAt: -1 }).skip(skip).limit(Number(limit))

    const total = await User.countDocuments(filter)

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalUsers: total,
          hasNextPage: skip + Number(limit) < total,
          hasPrevPage: Number(page) > 1,
        },
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    })
  }
}

// Update user status
export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { isActive, role } = req.body

    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    const updateData = {}
    if (isActive !== undefined) updateData.isActive = isActive
    if (role && ["customer", "admin"].includes(role)) updateData.role = role

    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password")

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: { user: updatedUser },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error.message,
    })
  }
}

// Category Management
export const getAllCategories = async (req, res) => {
  try {
    const { includeInactive = false } = req.query

    const filter = includeInactive === "true" ? {} : { isActive: true }

    const categories = await Category.find(filter)
      .populate("parent", "name")
      .populate("subcategories")
      .sort({ sortOrder: 1, name: 1 })

    res.status(200).json({
      success: true,
      data: { categories },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: error.message,
    })
  }
}

// Create category
export const createCategory = async (req, res) => {
  try {
    const categoryData = req.body

    const category = await Category.create(categoryData)
    await category.populate("parent", "name")

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: { category },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create category",
      error: error.message,
    })
  }
}

// Update category
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    const category = await Category.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).populate("parent", "name")

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      })
    }

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: { category },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update category",
      error: error.message,
    })
  }
}

// Delete category
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params

    // Check if category has products
    const productCount = await Product.countDocuments({ category: id })
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete category with existing products",
      })
    }

    // Check if category has subcategories
    const subcategoryCount = await Category.countDocuments({ parent: id })
    if (subcategoryCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete category with subcategories",
      })
    }

    await Category.findByIdAndDelete(id)

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete category",
      error: error.message,
    })
  }
}

// Coupon Management
export const getAllCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive, search } = req.query

    const filter = {}
    if (isActive !== undefined) filter.isActive = isActive === "true"
    if (search) {
      filter.$or = [{ code: new RegExp(search, "i") }, { name: new RegExp(search, "i") }]
    }

    const skip = (Number(page) - 1) * Number(limit)

    const coupons = await Coupon.find(filter)
      .populate("createdBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))

    const total = await Coupon.countDocuments(filter)

    res.status(200).json({
      success: true,
      data: {
        coupons,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalCoupons: total,
          hasNextPage: skip + Number(limit) < total,
          hasPrevPage: Number(page) > 1,
        },
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch coupons",
      error: error.message,
    })
  }
}

// Create coupon
export const createCoupon = async (req, res) => {
  try {
    const couponData = { ...req.body, createdBy: req.user._id }

    const coupon = await Coupon.create(couponData)
    await coupon.populate("createdBy", "firstName lastName")

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: { coupon },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create coupon",
      error: error.message,
    })
  }
}

// Update coupon
export const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    const coupon = await Coupon.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).populate("createdBy", "firstName lastName")

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      })
    }

    res.status(200).json({
      success: true,
      message: "Coupon updated successfully",
      data: { coupon },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update coupon",
      error: error.message,
    })
  }
}

// Delete coupon
export const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params

    await Coupon.findByIdAndDelete(id)

    res.status(200).json({
      success: true,
      message: "Coupon deleted successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete coupon",
      error: error.message,
    })
  }
}

// System Health Check
export const getSystemHealth = async (req, res) => {
  try {
    const [dbStats, serverStats] = await Promise.all([
      // Database statistics
      Promise.all([
        User.countDocuments(),
        Product.countDocuments(),
        Order.countDocuments(),
        Category.countDocuments(),
        Coupon.countDocuments(),
      ]),
      // Server statistics
      {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        version: process.version,
        platform: process.platform,
      },
    ])

    res.status(200).json({
      success: true,
      data: {
        database: {
          users: dbStats[0],
          products: dbStats[1],
          orders: dbStats[2],
          categories: dbStats[3],
          coupons: dbStats[4],
        },
        server: serverStats,
        timestamp: new Date(),
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch system health",
      error: error.message,
    })
  }
}
