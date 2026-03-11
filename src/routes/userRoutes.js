const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const {
  verifyToken,
  checkPermission,
} = require("../middlewares/authMiddleware");

const MENU_ID = "1";

router.get(
  "/",
  [verifyToken, checkPermission(MENU_ID, "view")],
  userController.getBrowseUsers,
);
router.get("/list", verifyToken, userController.getUserList);
router.post("/change-password", [verifyToken], userController.changePassword);
// Endpoint untuk resource Form (Baru & Ubah)
router.get("/form-resources", [verifyToken], userController.getFormResources);
router.get(
  "/form-resources/:kode",
  [verifyToken],
  userController.getFormResources,
);

// Endpoint Simpan
router.post("/save", [verifyToken], userController.saveUser);
router.delete(
  "/:kode",
  [verifyToken, checkPermission(MENU_ID, "delete")],
  userController.deleteUser,
);

module.exports = router;
