import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token"
    );
  }
};

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

const loginUser = asyncHandler(async (req, res) => {
  // take from user either username or email and password
  console.log(req.body);
  const { email, username, password } = req.body;
  if (!(username || email)) {
    throw new ApiError(400, "username or email is required");
  }
  // check if the user exists
  const user = await User.findOne({
    $or: [{ username: username }, { email: email }],
  });
  // throw error - no such user
  if (!user) {
    throw new ApiError(404, "User does not exist");
  }
  // if user exists - then check if the password is correct (from method of user)
  const isPasswordValid = await user.isPasswordCorrect(password);
  // if pass correct - generate access token and refresh token for user
  //// send cookie
  if (!isPasswordValid) {
    throw new ApiError(401, "Incorrect Password");
  }
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  ); // we did this step because in our user instance, there is no refresh token and the password field is extra
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In Successfully"
      )
    );
  // if pass incorrect -
});

const logoutUser = asyncHandler(async (req, res) => {
  // delete refresh token and cookies from user

  // delete refresh token from db
  await User.findByIdAndUpdate(
    req.user._id,
    { $set: { refreshToken: undefined } },
    { new: true }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options) // delete accessToken and refreshToken from cookies
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged Out Successfully"));
});

const refreshToken = asyncHandler(async (req, res) => {
  try {
    const incomingRefreshToken =
      req.cookies.refreshToken || req.body.refreshToken;

    if (incomingRefreshToken) {
      throw new ApiError(401, "unauthorized request");
    }
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid Refresh Token");
    }

    if (incomingRefreshToken != user.refreshToken) {
      throw new ApiError(401, "Refresh Token is Expired or Used");
    }

    const { newAccessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", newAccessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { newAccessToken, newRefreshToken },
          "Access Renewed Successfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Refresh Token");
  }
});
export { registerUser, loginUser, logoutUser, refreshToken };
