import { v2 as cloudinary } from "cloudinary"

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Upload image to Cloudinary
export const uploadToCloudinary = async (buffer, folder = "products") => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: "auto",
          transformation: [{ width: 800, height: 800, crop: "limit" }, { quality: "auto" }, { format: "auto" }],
        },
        (error, result) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        },
      )
      .end(buffer)
  })
}

// Delete image from Cloudinary
export const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId)
    return result
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error)
    throw error
  }
}
