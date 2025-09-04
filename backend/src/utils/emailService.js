import nodemailer from "nodemailer"

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

// Email templates
const emailTemplates = {
  emailVerification: (data) => ({
    subject: "Verify Your Email Address",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome ${data.name}!</h2>
        <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
        <a href="${data.verificationUrl}" 
           style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Verify Email
        </a>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p>${data.verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
      </div>
    `,
  }),

  passwordReset: (data) => ({
    subject: "Password Reset Request",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hello ${data.name},</p>
        <p>You requested a password reset. Click the button below to reset your password:</p>
        <a href="${data.resetUrl}" 
           style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Reset Password
        </a>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p>${data.resetUrl}</p>
        <p>This link will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `,
  }),
}

// Send email function
export const sendEmail = async ({ to, subject, template, data }) => {
  try {
    const transporter = createTransporter()

    let emailContent
    if (template && emailTemplates[template]) {
      emailContent = emailTemplates[template](data)
    } else {
      emailContent = { subject, html: data.html || data.text }
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || "noreply@ecommerce.com",
      to,
      subject: emailContent.subject,
      html: emailContent.html,
    }

    const result = await transporter.sendMail(mailOptions)
    console.log("Email sent successfully:", result.messageId)
    return result
  } catch (error) {
    console.error("Email sending failed:", error)
    throw error
  }
}
