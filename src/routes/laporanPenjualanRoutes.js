const express = require("express");
const router = express.Router();
const laporanPenjualanController = require("../controllers/laporanPenjualanController");
const {
  verifyToken,
  checkPermission,
} = require("../middlewares/authMiddleware");

const MENU_ID = "52"; // Menu ID untuk Laporan Penjualan

router.get(
  "/",
  [verifyToken, checkPermission(MENU_ID, "view")],
  laporanPenjualanController.getLaporanPenjualan,
);

module.exports = router;
