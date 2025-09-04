import mongoose from "mongoose"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't include password in queries by default
    },
    role: {
      type: String,
      enum: ["customer", "admin"],
      default: "customer",
    },
    avatar: {
      public_id: String,
      url: String,
    },
    phone: {
      type: String,
      match: [/^\+?[\d\s-()]+$/, "Please enter a valid phone number"],
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
    emailVerificationToken: String,
    emailVerificationExpires: Date,
  },
  {
    timestamps: true,
  },
)

// Index for better query performance
userSchema.index({ email: 1 })
userSchema.index({ role: 1 })

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next()

  try {
    const salt = await bcrypt.genSalt(12)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error)
  }
})

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password)
}

// Generate JWT token
userSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      role: this.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || "30d",
    },
  )
}

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function () {
  const resetToken = jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: "10m",
  })

  this.passwordResetToken = resetToken
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000 // 10 minutes

  return resetToken
}

// Generate email verification token
userSchema.methods.generateEmailVerificationToken = function () {
  const verificationToken = jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: "24h",
  })

  this.emailVerificationToken = verificationToken
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000 // 24 hours

  return verificationToken
}

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`
})

// Transform output
userSchema.methods.toJSON = function () {
  const user = this.toObject()
  delete user.password
  delete user.passwordResetToken
  delete user.passwordResetExpires
  delete user.emailVerificationToken
  delete user.emailVerificationExpires
  return user
}

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - firstName
 *         - lastName
 *         - email
 *         - password
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated user ID
 *         firstName:
 *           type: string
 *           maxLength: 50
 *         lastName:
 *           type: string
 *           maxLength: 50
 *         email:
 *           type: string
 *           format: email
 *         role:
 *           type: string
 *           enum: [customer, admin]
 *           default: customer
 *         avatar:
 *           type: object
 *           properties:
 *             public_id:
 *               type: string
 *             url:
 *               type: string
 *         phone:
 *           type: string
 *         address:
 *           type: object
 *           properties:
 *             street:
 *               type: string
 *             city:
 *               type: string
 *             state:
 *               type: string
 *             zipCode:
 *               type: string
 *             country:
 *               type: string
 *         isEmailVerified:
 *           type: boolean
 *           default: false
 *         isActive:
 *           type: boolean
 *           default: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

export default mongoose.model("User", userSchema)
