import { v2 as cloudinary } from "cloudinary";
// Removed 'fs' and 'path' as we are not using the local file system.
// We also no longer need 'fs.unlinkSync' because no local file is created.

// Configuration
cloudinary.config({
  cloud_name: process.env.VITE_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.VITE_CLOUDINARY_API_KEY,
  api_secret: process.env.VITE_CLOUDINARY_SECRET_KEY,
});

// Use a new async function that accepts the file object from Multer (req.file)
const uploadInCloudinary = async (file) => {
  try {
    if (!file) return null;

    // Use upload_stream to upload the file directly from memory.
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ resource_type: "auto" }, (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        })
        .end(file.buffer); // Pass the file buffer directly
    });

    return uploadResult;
  } catch (error) {
    console.error("Cloudinary upload failed:", error);
    return null;
  }
};

export { uploadInCloudinary };
