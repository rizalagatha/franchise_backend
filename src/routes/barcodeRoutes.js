const express = require("express");
const router = express.Router();
const barcodeController = require("../controllers/barcodeController");
const {
  verifyToken,
  checkPermission,
  checkSavePermission,
} = require("../middlewares/authMiddleware");

const BARCODE_MENU_ID = "13";

// GET /api/barcodes - Ambil Headers (Perlu view) + Filter Tanggal
router.get(
  "/",
  [verifyToken, checkPermission(BARCODE_MENU_ID, "view")],
  barcodeController.getHeaders
);

// GET /api/barcodes/:nomor/details - Ambil Details (Perlu view)
router.get(
  "/:nomor/details",
  [verifyToken, checkPermission(BARCODE_MENU_ID, "view")],
  barcodeController.getDetails
);

// DELETE /api/barcodes/:nomor - Hapus Header & Detail (Perlu delete)
router.delete(
  "/:nomor",
  [verifyToken, checkPermission(BARCODE_MENU_ID, "delete")],
  barcodeController.deleteBarcodeData
);

// GET /api/barcodes/lookup - Cari barang (Perlu view atau insert/edit?)
router.get(
  "/lookup/barang", // Gunakan path yang lebih spesifik
  // Asumsi user perlu hak insert atau edit untuk bisa lookup barang
  [verifyToken, checkPermission(BARCODE_MENU_ID, "insert")], // Atau 'edit' atau 'view'
  barcodeController.lookupItem
);

// GET /api/barcodes/details/:kode (Mengambil semua varian)
router.get(
    '/details/:kode',
    [verifyToken, checkPermission(BARCODE_MENU_ID, 'insert')], // Asumsi izin insert
    barcodeController.getVarianDetails
);

// GET /api/barcodes/form/:nomor - Load data form edit (Perlu edit)
router.get(
  "/form/:nomor",
  [verifyToken, checkPermission(BARCODE_MENU_ID, "edit")],
  barcodeController.getFormData
);

// POST /api/barcodes/save - Simpan data (Create/Update)
router.post(
  "/save", // Satu endpoint untuk save
  [verifyToken, checkSavePermission(BARCODE_MENU_ID)], // Middleware cek insert/edit
  barcodeController.saveData
);

module.exports = router;
