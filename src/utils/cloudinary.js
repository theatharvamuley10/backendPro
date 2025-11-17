import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (loaclFilePath) => {
  try {
    if (!loaclFilePath) return null;

    // upload the file on cloudinary
    const response = await cloudinary.uploader.upload(loaclFilePath, {
      resource_type: "auto",
    });
    // file has been uploaded successfully
    console.log(
      "The file is successfully uploaded on cloudinary: ",
      response.url
    );

    return response;
  } catch (error) {
    fs.unlinkSync(loaclFilePath); // remove the locally saved temporary file as the upload operation failed
    return null;
  }
};

export default uploadOnCloudinary;
