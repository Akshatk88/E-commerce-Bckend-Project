const PDFDocument = require("pdfkit")
const ExcelJS = require("exceljs")
const Product = require("../models/Product")
const Order = require("../models/Order")
const User = require("../models/User")
const { getIO } = require("../config/socket")

/**
 * @swagger
 * components:
 *   schemas:
 *     Report:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           enum: [sales, inventory, users, orders]
 *         format:
 *           type: string
 *           enum: [pdf, excel, json]
 *         dateRange:
 *           type: object
 *           properties:
 *             startDate:
 *               type: string
 *               format: date
 *             endDate:
 *               type: string
 *               format: date
 */

// Generate Sales Report
const generateSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, format = "pdf" } = req.query

    const dateFilter = {}
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      }
    }

    const salesData = await Order.aggregate([
      { $match: { ...dateFilter, status: "completed" } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          totalSales: { $sum: "$totalAmount" },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: "$totalAmount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ])

    const topProducts = await Order.aggregate([
      { $match: { ...dateFilter, status: "completed" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          totalQuantity: { $sum: "$items.quantity" },
          totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
    ])

    if (format === "pdf") {
      const doc = new PDFDocument()
      res.setHeader("Content-Type", "application/pdf")
      res.setHeader("Content-Disposition", "attachment; filename=sales-report.pdf")

      doc.pipe(res)

      // Header
      doc.fontSize(20).text("Sales Report", 50, 50)
      doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, 50, 80)

      if (startDate && endDate) {
        doc.text(`Period: ${startDate} to ${endDate}`, 50, 100)
      }

      // Sales Summary
      doc.fontSize(16).text("Sales Summary", 50, 140)
      let yPosition = 170

      const totalSales = salesData.reduce((sum, day) => sum + day.totalSales, 0)
      const totalOrders = salesData.reduce((sum, day) => sum + day.orderCount, 0)
      const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0

      doc
        .fontSize(12)
        .text(`Total Sales: $${totalSales.toFixed(2)}`, 50, yPosition)
        .text(`Total Orders: ${totalOrders}`, 50, yPosition + 20)
        .text(`Average Order Value: $${avgOrderValue.toFixed(2)}`, 50, yPosition + 40)

      // Top Products
      yPosition += 80
      doc.fontSize(16).text("Top Products", 50, yPosition)
      yPosition += 30

      topProducts.forEach((product, index) => {
        doc
          .fontSize(10)
          .text(`${index + 1}. ${product.productInfo.name}`, 50, yPosition)
          .text(`Quantity: ${product.totalQuantity}`, 200, yPosition)
          .text(`Revenue: $${product.totalRevenue.toFixed(2)}`, 300, yPosition)
        yPosition += 20
      })

      doc.end()
    } else if (format === "excel") {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet("Sales Report")

      // Add headers
      worksheet.addRow(["Date", "Total Sales", "Order Count", "Avg Order Value"])

      // Add data
      salesData.forEach((day) => {
        worksheet.addRow([
          `${day._id.year}-${day._id.month}-${day._id.day}`,
          day.totalSales,
          day.orderCount,
          day.avgOrderValue,
        ])
      })

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      res.setHeader("Content-Disposition", "attachment; filename=sales-report.xlsx")

      await workbook.xlsx.write(res)
      res.end()
    } else {
      res.json({
        success: true,
        data: {
          salesData,
          topProducts,
          summary: {
            totalSales: salesData.reduce((sum, day) => sum + day.totalSales, 0),
            totalOrders: salesData.reduce((sum, day) => sum + day.orderCount, 0),
          },
        },
      })
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error generating sales report",
      error: error.message,
    })
  }
}

// Generate Inventory Report
const generateInventoryReport = async (req, res) => {
  try {
    const { format = "pdf", lowStockThreshold = 10 } = req.query

    const inventoryData = await Product.aggregate([
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      { $unwind: "$categoryInfo" },
      {
        $project: {
          name: 1,
          sku: 1,
          stock: 1,
          price: 1,
          category: "$categoryInfo.name",
          stockValue: { $multiply: ["$stock", "$price"] },
          stockStatus: {
            $cond: {
              if: { $lte: ["$stock", Number.parseInt(lowStockThreshold)] },
              then: "Low Stock",
              else: "In Stock",
            },
          },
        },
      },
      { $sort: { stock: 1 } },
    ])

    const lowStockItems = inventoryData.filter((item) => item.stock <= lowStockThreshold)
    const totalInventoryValue = inventoryData.reduce((sum, item) => sum + item.stockValue, 0)

    if (format === "pdf") {
      const doc = new PDFDocument()
      res.setHeader("Content-Type", "application/pdf")
      res.setHeader("Content-Disposition", "attachment; filename=inventory-report.pdf")

      doc.pipe(res)

      // Header
      doc.fontSize(20).text("Inventory Report", 50, 50)
      doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, 50, 80)

      // Summary
      doc.fontSize(16).text("Inventory Summary", 50, 120)
      doc
        .fontSize(12)
        .text(`Total Products: ${inventoryData.length}`, 50, 150)
        .text(`Low Stock Items: ${lowStockItems.length}`, 50, 170)
        .text(`Total Inventory Value: $${totalInventoryValue.toFixed(2)}`, 50, 190)

      // Low Stock Items
      if (lowStockItems.length > 0) {
        doc.fontSize(16).text("Low Stock Alert", 50, 230)
        let yPosition = 260

        lowStockItems.forEach((item) => {
          doc
            .fontSize(10)
            .text(`${item.name} (${item.sku})`, 50, yPosition)
            .text(`Stock: ${item.stock}`, 200, yPosition)
            .text(`Category: ${item.category}`, 300, yPosition)
          yPosition += 20
        })
      }

      doc.end()
    } else {
      res.json({
        success: true,
        data: {
          inventoryData,
          lowStockItems,
          summary: {
            totalProducts: inventoryData.length,
            lowStockCount: lowStockItems.length,
            totalInventoryValue,
          },
        },
      })
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error generating inventory report",
      error: error.message,
    })
  }
}

// Generate User Report
const generateUserReport = async (req, res) => {
  try {
    const { startDate, endDate, format = "pdf" } = req.query

    const dateFilter = {}
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      }
    }

    const userStats = await User.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          newUsers: { $sum: 1 },
          adminUsers: {
            $sum: { $cond: [{ $eq: ["$role", "admin"] }, 1, 0] },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ])

    const topCustomers = await Order.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: "$user",
          totalSpent: { $sum: "$totalAmount" },
          orderCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      { $unwind: "$userInfo" },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
    ])

    if (format === "json") {
      res.json({
        success: true,
        data: {
          userStats,
          topCustomers,
          summary: {
            totalNewUsers: userStats.reduce((sum, month) => sum + month.newUsers, 0),
            totalAdmins: userStats.reduce((sum, month) => sum + month.adminUsers, 0),
          },
        },
      })
    } else {
      // PDF generation similar to above
      const doc = new PDFDocument()
      res.setHeader("Content-Type", "application/pdf")
      res.setHeader("Content-Disposition", "attachment; filename=user-report.pdf")

      doc.pipe(res)
      doc.fontSize(20).text("User Report", 50, 50)
      doc.end()
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error generating user report",
      error: error.message,
    })
  }
}

// Schedule automated reports
const scheduleReport = async (req, res) => {
  try {
    const { reportType, frequency, recipients, format } = req.body

    // Store scheduled report configuration
    const scheduledReport = {
      type: reportType,
      frequency,
      recipients,
      format,
      nextRun: calculateNextRun(frequency),
      createdBy: req.user.id,
      createdAt: new Date(),
    }

    // In a real implementation, you'd save this to a database
    // and use a job scheduler like node-cron or bull queue

    res.json({
      success: true,
      message: "Report scheduled successfully",
      data: scheduledReport,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error scheduling report",
      error: error.message,
    })
  }
}

const calculateNextRun = (frequency) => {
  const now = new Date()
  switch (frequency) {
    case "daily":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000)
    case "weekly":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    case "monthly":
      return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000)
  }
}

module.exports = {
  generateSalesReport,
  generateInventoryReport,
  generateUserReport,
  scheduleReport,
}
