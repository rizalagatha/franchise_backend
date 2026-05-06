// src/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const {
  verifyToken,
  checkPermission,
} = require("../middlewares/authMiddleware");

const MENU_ID = "1";

// Karena mengakses Master DB, tidak perlu injectBranchDb
router.get(
  "/",
  [verifyToken, checkPermission(MENU_ID, "view")],
  userController.getBrowseUsers,
);
router.get("/list", [verifyToken], userController.getUserList);

router.get("/form-resources", [verifyToken], userController.getFormResources);
router.get(
  "/form-resources/:kode",
  [verifyToken],
  userController.getFormResources,
);

router.post(
  "/save",
  [verifyToken, checkPermission(MENU_ID, "insert")],
  userController.saveUser,
);
router.delete(
  "/:kode",
  [verifyToken, checkPermission(MENU_ID, "delete")],
  userController.deleteUser,
);
router.post(
  "/change-password",
  [verifyToken], // Cukup verifyToken untuk ambil data req.user
  userController.changePassword,
);
router.post("/accept-terms", [verifyToken], userController.acceptTerms);

module.exports = router;
