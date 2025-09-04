import cron from "node-cron"
import Product from "../models/Product.js"
import { generateDailyReport } from "./reportGenerator.js"

export const startScheduledTasks = () => {
  // Daily stock audit at 2 AM
  cron.schedule("0 2 * * *", async () => {
    console.log("🔍 Running daily stock audit...")
    try {
      const lowStockProducts = await Product.find({ stock: { $lt: 10 } })

      if (lowStockProducts.length > 0) {
        // Emit low stock alert to admin
        global.emitAdminAnalytics({
          type: "low_stock_alert",
          products: lowStockProducts,
          timestamp: new Date(),
        })
      }

      console.log(`✅ Stock audit completed. ${lowStockProducts.length} products with low stock.`)
    } catch (error) {
      console.error("❌ Stock audit failed:", error)
    }
  })

  // Generate daily sales report at 11:59 PM
  cron.schedule("59 23 * * *", async () => {
    console.log("📊 Generating daily sales report...")
    try {
      await generateDailyReport()
      console.log("✅ Daily sales report generated successfully")
    } catch (error) {
      console.error("❌ Daily report generation failed:", error)
    }
  })

  // Clean up expired sessions every hour
  cron.schedule("0 * * * *", async () => {
    console.log("🧹 Cleaning up expired sessions...")
    // Add session cleanup logic here if using custom session storage
  })

  console.log("⏰ Scheduled tasks initialized")
}
