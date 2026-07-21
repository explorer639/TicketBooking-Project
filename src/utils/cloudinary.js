import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Uploads a local file to Cloudinary, then removes the local temp copy.
// Returns the Cloudinary response (with .url) on success, or null on failure.
const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;

        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
        });

        fs.unlinkSync(localFilePath); 
        return response;
    } catch (error) {
        // clean up the temp file even if upload failed, so /public/temp doesn't accumulate orphaned files
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        console.error("Cloudinary upload failed:", error);
        return null;
    }
};

export { uploadOnCloudinary };
