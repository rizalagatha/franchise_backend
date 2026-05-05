const express = require("express");
const router = express.Router();
const priceListController = require("../controllers/priceListController");
const {
  verifyToken,
  checkPermission,
} = require("../middlewares/authMiddleware");
const { injectBranchDb } = require("../middlewares/branchMiddleware");

const PRICE_LIST_MENU_ID = "12";

// GET /api/price-list - Ambil semua data (Perlu izin view)
router.get(
  "/",
  [verifyToken, injectBranchDb, checkPermission(PRICE_LIST_MENU_ID, "view")],
  priceListController.getAllPriceListData,
);

// GET /api/price-list/:kode/:ukuran/history (Perlu izin view)
router.get(
  "/:kode/:ukuran/history",
  [verifyToken, injectBranchDb, checkPermission(PRICE_LIST_MENU_ID, "view")],
  priceListController.getHistory,
);

// PUT /api/price-list/:kode/:ukuran - Update harga (Perlu izin edit)
router.put(
  "/:kode/:ukuran",
  [verifyToken, injectBranchDb, checkPermission(PRICE_LIST_MENU_ID, "edit")],
  priceListController.updateItemPrice,
);

module.exports = router;
