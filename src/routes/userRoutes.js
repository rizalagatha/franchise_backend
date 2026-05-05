const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const {
  verifyToken,
  checkPermission,
} = require("../middlewares/authMiddleware");
const { injectBranchDb } = require("../middlewares/branchMiddleware");

const MENU_ID = "1";

router.get(
  "/",
  [verifyToken, injectBranchDb, checkPermission(MENU_ID, "view")],
  userController.getBrowseUsers,
);
router.get("/list", [verifyToken, injectBranchDb], userController.getUserList);
router.post(
  "/change-password",
  [verifyToken, injectBranchDb],
  userController.changePassword,
);

// Endpoint untuk resource Form (Baru & Ubah)
router.get(
  "/form-resources",
  [verifyToken, injectBranchDb],
  userController.getFormResources,
);
router.get(
  "/form-resources/:kode",
  [verifyToken, injectBranchDb],
  userController.getFormResources,
);

// Endpoint Simpan
router.post("/save", [verifyToken, injectBranchDb], userController.saveUser);
router.delete(
  "/:kode",
  [verifyToken, injectBranchDb, checkPermission(MENU_ID, "delete")],
  userController.deleteUser,
);

module.exports = router;
