import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  // get the input info via frontend- name, gmail, password,  username, avatar, cover image
  const { fullname, username, email, password } = req.body;

  // validate the data sent from frontend
  // usually in production grade code these validations are in a single separate file
  if (
    [fullname, email, username, password].some((field) => {
      if (field === "" || field === undefined || field === null) return 1;
    })
  ) {
    throw new ApiError(400, "All fields are required!");
  }
  if (!email.includes("@")) {
    throw new ApiError(400, "Invalid Email");
  }

  // check if user already exists - (email & username)
  const existingUser = await User.findOne({
    $or: [{ username: username }, { email: email }],
  });
  if (existingUser) {
    throw new ApiError(409, "User already exists");
  }

  // check if cover image sent, check for avatar
  let avatarLocalPathTemp = null;
  if (
    req.files &&
    Array.isArray(req.files.avatar) &&
    req.files.avatar.length > 0
  ) {
    avatarLocalPathTemp = req.files.avatar[0].path;
  }
  const avatarLocalPath = avatarLocalPathTemp;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPathTemp = null;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPathTemp = req.files.coverImage[0].path;
  }
  const coverImageLocalPath = coverImageLocalPathTemp;

  // upload to cloudinary - cover image if sent, avatar for sure
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  // create user object - create entry in db
  const user = await User.create({
    username: username.toLowerCase(),
    email: email,
    fullname: fullname,
    avatar: avatar.url,
    password: password,
    coverImage: coverImage ? coverImage.url : "",
  });

  // check if response came or not (user created or not)
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // if user creation failed - return error
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while creating the user");
  }

  // if user created - return user // remove password and refresh token field from response
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));

  // watch history and refresh token I will generate programmatically
});

export { registerUser };
