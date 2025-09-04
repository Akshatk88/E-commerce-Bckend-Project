import User from "../models/User.js"
import jwt from "jsonwebtoken"
import { sendEmail } from "../utils/emailService.js"

// Register user
export const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      })
    }

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone,
    })

    // Generate email verification token
    const verificationToken = user.generateEmailVerificationToken()
    await user.save()

    // Send verification email
    try {
      await sendEmail({
        to: user.email,
        subject: "Verify Your Email Address",
        template: "emailVerification",
        data: {
          name: user.fullName,
          verificationToken,
          verificationUrl: `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`,
        },
      })
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError)
    }

    // Generate auth token
    const token = user.generateAuthToken()

    res.status(201).json({
      success: true,
      message: "User registered successfully. Please check your email for verification.",
      data: {
        user,
        token,
      },
    })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    })
  }
}

// Login user
export const login = async (req, res) => {
  try {
    const { email, password } = req.body

    // Find user and include password
    const user = await User.findOne({ email }).select("+password")

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      })
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated. Please contact support.",
      })
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password)

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      })
    }

    // Update last login
    user.lastLogin = new Date()
    await user.save()

    // Generate token
    const token = user.generateAuthToken()

    // Remove password from response
    user.password = undefined

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user,
        token,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    })
  }
}

// Logout user
export const logout = async (req, res) => {
  try {
    // In a stateless JWT system, logout is handled client-side
    // You could implement token blacklisting here if needed
    res.status(200).json({
      success: true,
      message: "Logout successful",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Logout failed",
      error: error.message,
    })
  }
}

// Get user profile
export const getProfile = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        user: req.user,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get profile",
      error: error.message,
    })
  }
}

// Update user profile
export const updateProfile = async (req, res) => {
  try {
    const allowedUpdates = ["firstName", "lastName", "phone", "address"]
    const updates = {}

    // Filter allowed updates
    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key]
      }
    })

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    })

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message,
    })
  }
}

// Change password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    // Get user with password
    const user = await User.findById(req.user._id).select("+password")

    // Check current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword)

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      })
    }

    // Update password
    user.password = newPassword
    await user.save()

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to change password",
      error: error.message,
    })
  }
}

// Forgot password
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body

    const user = await User.findOne({ email })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with this email",
      })
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken()
    await user.save()

    // Send reset email
    try {
      await sendEmail({
        to: user.email,
        subject: "Password Reset Request",
        template: "passwordReset",
        data: {
          name: user.fullName,
          resetToken,
          resetUrl: `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`,
        },
      })

      res.status(200).json({
        success: true,
        message: "Password reset email sent successfully",
      })
    } catch (emailError) {
      user.passwordResetToken = undefined
      user.passwordResetExpires = undefined
      await user.save()

      return res.status(500).json({
        success: false,
        message: "Failed to send password reset email",
      })
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to process password reset request",
      error: error.message,
    })
  }
}

// Reset password
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body

    // Verify token
    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      })
    }

    // Find user with valid reset token
    const user = await User.findOne({
      _id: decoded.id,
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() },
    })

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      })
    }

    // Update password
    user.password = password
    user.passwordResetToken = undefined
    user.passwordResetExpires = undefined
    await user.save()

    res.status(200).json({
      success: true,
      message: "Password reset successful",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to reset password",
      error: error.message,
    })
  }
}

// Verify email
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body

    // Verify token
    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      })
    }

    // Find user with valid verification token
    const user = await User.findOne({
      _id: decoded.id,
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() },
    })

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      })
    }

    // Update user
    user.isEmailVerified = true
    user.emailVerificationToken = undefined
    user.emailVerificationExpires = undefined
    await user.save()

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to verify email",
      error: error.message,
    })
  }
}

// Resend verification email
export const resendVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      })
    }

    // Generate new verification token
    const verificationToken = user.generateEmailVerificationToken()
    await user.save()

    // Send verification email
    await sendEmail({
      to: user.email,
      subject: "Verify Your Email Address",
      template: "emailVerification",
      data: {
        name: user.fullName,
        verificationToken,
        verificationUrl: `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`,
      },
    })

    res.status(200).json({
      success: true,
      message: "Verification email sent successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to resend verification email",
      error: error.message,
    })
  }
}
