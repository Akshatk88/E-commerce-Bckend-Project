const Order = require("../models/Order")
const Product = require("../models/Product")
const User = require("../models/User")

// Get dashboard analytics
const getDashboardAnalytics = async (req, res) => {
  try {
    const { period = "30d" } = req.query

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()

    switch (period) {
      case "7d":
        startDate.setDate(endDate.getDate() - 7)
        break
      case "30d":
        startDate.setDate(endDate.getDate() - 30)
        break
      case "90d":
        startDate.setDate(endDate.getDate() - 90)
        break
      case "1y":
        startDate.setFullYear(endDate.getFullYear() - 1)
        break
      default:
        startDate.setDate(endDate.getDate() - 30)
    }

    // Revenue analytics
    const revenueData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: "completed",
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          revenue: { $sum: "$totalAmount" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ])

    // Product performance
    const productPerformance = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: "completed",
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          totalSold: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ])

    // User growth
    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          newUsers: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ])

    // Summary statistics
    const totalRevenue = revenueData.reduce((sum, day) => sum + day.revenue, 0)
    const totalOrders = revenueData.reduce((sum, day) => sum + day.orders, 0)
    const totalNewUsers = userGrowth.reduce((sum, day) => sum + day.newUsers, 0)
    const totalProducts = await Product.countDocuments()
    const lowStockProducts = await Product.countDocuments({ stock: { $lte: 10 } })

    res.json({
      success: true,
      data: {
        summary: {
          totalRevenue,
          totalOrders,
          totalNewUsers,
          totalProducts,
          lowStockProducts,
          avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        },
        charts: {
          revenue: revenueData,
          productPerformance,
          userGrowth,
        },
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching analytics data",
      error: error.message,
    })
  }
}

// Get real-time metrics
const getRealTimeMetrics = async (req, res) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: today },
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,
          todayRevenue: { $sum: "$totalAmount" },
          todayOrders: { $sum: 1 },
        },
      },
    ])

    const activeUsers = await User.countDocuments({
      lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    })

    const pendingOrders = await Order.countDocuments({
      status: { $in: ["pending", "processing"] },
    })

    res.json({
      success: true,
      data: {
        todayRevenue: todayStats[0]?.todayRevenue || 0,
        todayOrders: todayStats[0]?.todayOrders || 0,
        activeUsers,
        pendingOrders,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching real-time metrics",
      error: error.message,
    })
  }
}

module.exports = {
  getDashboardAnalytics,
  getRealTimeMetrics,
}
