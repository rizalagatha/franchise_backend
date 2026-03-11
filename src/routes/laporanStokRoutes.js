const express = require("express");
const router = express.Router();
const laporanStokController = require("../controllers/laporanStokController");
const {
  verifyToken,
  checkPermission,
} = require("../middlewares/authMiddleware");

const MENU_ID = "51"; // Menu ID untuk Laporan Stok

// Endpoint: GET /api/laporan-stok
router.get(
  "/",
  [verifyToken, checkPermission(MENU_ID, "view")],
  laporanStokController.getLaporanStok,
);

module.exports = router;
