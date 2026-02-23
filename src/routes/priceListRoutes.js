const express = require("express");
const router = express.Router();
const priceListController = require("../controllers/priceListController");
const {
  verifyToken,
  checkPermission,
} = require("../middlewares/authMiddleware");

const PRICE_LIST_MENU_ID = "12";

// GET /api/price-list - Ambil semua data (Perlu izin view)
router.get(
  "/",
  [verifyToken, checkPermission(PRICE_LIST_MENU_ID, "view")],
  priceListController.getAllPriceListData
);

// GET /api/price-list/:kode/:ukuran/history (Perlu izin view)
router.get(
  "/:kode/:ukuran/history",
  [verifyToken, checkPermission(PRICE_LIST_MENU_ID, "view")],
  priceListController.getHistory
);

// PUT /api/price-list/:kode/:ukuran - Update harga (Perlu izin edit)
router.put(
  "/:kode/:ukuran",
  [verifyToken, checkPermission(PRICE_LIST_MENU_ID, "edit")],
  priceListController.updateItemPrice
);

// GET /api/price-list/:kode/:ukuran/history (Nanti)

module.exports = router;
