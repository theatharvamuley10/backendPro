import { Router } from "express";
import {
  changeCurrentPassword,
  getCurrentUser,
  getUserChannelProfile,
  getWatchHistory,
  loginUser,
  logoutUser,
  refreshToken,
  registerUser,
  updateAccountDetails,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  registerUser
);
router.route("/login").post(upload.none(), loginUser);

router.route("/logout").post(upload.none(), verifyJWT, logoutUser);

router.route("/refresh-Token").post(upload.none(), refreshToken);

router
  .route("/change-Password")
  .post(upload.none(), verifyJWT, changeCurrentPassword);
router.route("/current-user").get(verifyJWT, getCurrentUser);

router
  .route("/update-account-details")
  .patch(upload.none(), verifyJWT, updateAccountDetails); // use patch varna sab update ho jaega

router.route("/channel/:username").get(verifyJWT, getUserChannelProfile);

router.route("/watch-history").get(verifyJWT, getWatchHistory);

export { router };
