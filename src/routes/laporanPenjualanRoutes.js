const express = require("express");
const router = express.Router();
const laporanPenjualanController = require("../controllers/laporanPenjualanController");
const {
  verifyToken,
  checkPermission,
} = require("../middlewares/authMiddleware");
const { injectBranchDb } = require("../middlewares/branchMiddleware");

const MENU_ID = "52"; // Menu ID untuk Laporan Penjualan

router.get(
  "/",
  [verifyToken, injectBranchDb, checkPermission(MENU_ID, "view")],
  laporanPenjualanController.getLaporanPenjualan,
);

module.exports = router;
