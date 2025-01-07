import {v2 as cloudinary} from "cloudinary"
import fs from "fs"
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) {
            console.error("No file path provided.");
            return null;
        }

        if (!fs.existsSync(localFilePath)) {
            console.error("File does not exist:", localFilePath);
            return null;
        }

        // Upload the file to Cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
        });

        // Remove the locally saved file after successful upload
        fs.unlinkSync(localFilePath);
        return response;

    } catch (error) {
        console.error("Cloudinary upload error:", error);
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath); // Clean up the local file
        }
        return null;
    }
};

export {uploadOnCloudinary}