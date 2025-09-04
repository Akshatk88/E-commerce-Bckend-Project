import Coupon from "../models/Coupon.js"

// Validate coupon code
export const validateCoupon = async (req, res) => {
  try {
    const { code, orderAmount = 0, items = [] } = req.body

    const coupon = await Coupon.findOne({ code: code.toUpperCase() })

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      })
    }

    // Check if coupon is valid
    if (!coupon.isValid()) {
      return res.status(400).json({
        success: false,
        message: "Coupon is expired or inactive",
      })
    }

    // Check if user can use this coupon
    if (!coupon.canUserUse(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "You have already used this coupon or reached the usage limit",
      })
    }

    // Calculate discount
    const discountAmount = coupon.calculateDiscount(orderAmount, items)

    if (discountAmount === 0) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of $${coupon.minimumOrderAmount} required`,
      })
    }

    res.status(200).json({
      success: true,
      message: "Coupon is valid",
      data: {
        coupon: {
          code: coupon.code,
          name: coupon.name,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
        },
        discountAmount,
        finalAmount: Math.max(0, orderAmount - discountAmount),
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to validate coupon",
      error: error.message,
    })
  }
}

// Get available coupons for user
export const getAvailableCoupons = async (req, res) => {
  try {
    const userId = req.user._id
    const now = new Date()

    const coupons = await Coupon.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: [{ applicableUsers: { $size: 0 } }, { applicableUsers: userId }],
    }).select("code name description discountType discountValue minimumOrderAmount startDate endDate")

    // Filter coupons based on usage limits
    const availableCoupons = coupons.filter((coupon) => coupon.canUserUse(userId))

    res.status(200).json({
      success: true,
      data: { coupons: availableCoupons },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch available coupons",
      error: error.message,
    })
  }
}
