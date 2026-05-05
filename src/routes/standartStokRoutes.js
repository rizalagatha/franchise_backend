const express = require("express");
const router = express.Router();
const standartStokController = require("../controllers/standartStokController");
const {
  verifyToken,
  checkPermission,
} = require("../middlewares/authMiddleware");
const { injectBranchDb } = require("../middlewares/branchMiddleware");

const STANDART_STOK_MENU_ID = "24";

// GET /api/standart-stok (Browse)
router.get(
  "/",
  [verifyToken, injectBranchDb, checkPermission(STANDART_STOK_MENU_ID, "view")],
  standartStokController.getStandartStok,
);

// PUT /api/standart-stok/update (Update Min/Max)
router.put(
  "/update",
  [verifyToken, injectBranchDb, checkPermission(STANDART_STOK_MENU_ID, "edit")],
  standartStokController.updateBufferData,
);

module.exports = router;
