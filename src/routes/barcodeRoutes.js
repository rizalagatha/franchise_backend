const express = require("express");
const router = express.Router();
const barcodeController = require("../controllers/barcodeController");

// Import dari middleware yang sudah dipisah fungsinya
const {
  verifyToken,
  checkPermission,
  checkSavePermission,
} = require("../middlewares/authMiddleware");
const { injectBranchDb } = require("../middlewares/branchMiddleware");

const BARCODE_MENU_ID = "13";

// GET /api/barcodes - Ambil Headers
router.get(
  "/",
  [verifyToken, injectBranchDb, checkPermission(BARCODE_MENU_ID, "view")],
  barcodeController.getHeaders,
);

// GET /api/barcodes/:nomor/details - Ambil Details
router.get(
  "/:nomor/details",
  [verifyToken, injectBranchDb, checkPermission(BARCODE_MENU_ID, "view")],
  barcodeController.getDetails,
);

// DELETE /api/barcodes/:nomor - Hapus Header & Detail
router.delete(
  "/:nomor",
  [verifyToken, injectBranchDb, checkPermission(BARCODE_MENU_ID, "delete")],
  barcodeController.deleteBarcodeData,
);

// GET /api/barcodes/lookup/barang - Cari barang
router.get(
  "/lookup/barang",
  [verifyToken, injectBranchDb, checkPermission(BARCODE_MENU_ID, "insert")],
  barcodeController.lookupItem,
);

// GET /api/barcodes/details/:kode (Mengambil semua varian)
router.get(
  "/details/:kode",
  [verifyToken, injectBranchDb, checkPermission(BARCODE_MENU_ID, "insert")],
  barcodeController.getVarianDetails,
);

// GET /api/barcodes/form/:nomor - Load data form edit
router.get(
  "/form/:nomor",
  [verifyToken, injectBranchDb, checkPermission(BARCODE_MENU_ID, "edit")],
  barcodeController.getFormData,
);

// POST /api/barcodes/save - Simpan data (Create/Update)
router.post(
  "/save",
  [verifyToken, injectBranchDb, checkSavePermission(BARCODE_MENU_ID)],
  barcodeController.saveData,
);

module.exports = router;
