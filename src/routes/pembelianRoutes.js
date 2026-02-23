const express = require("express");
const router = express.Router();
const pembelianController = require("../controllers/pembelianController");
const {
  verifyToken,
  checkPermission,
  checkSavePermission,
} = require("../middlewares/authMiddleware");

const PEMBELIAN_MENU_ID = "22";

// GET /api/pembelian - Ambil Headers (Perlu view)
router.get(
  "/",
  [verifyToken, checkPermission(PEMBELIAN_MENU_ID, "view")],
  pembelianController.getHeaders
);

// GET /api/pembelian/:nomor/details - Ambil Details (Perlu view)
router.get(
  "/:nomor/details",
  [verifyToken, checkPermission(PEMBELIAN_MENU_ID, "view")],
  pembelianController.getDetails
);

// DELETE /api/pembelian/:nomor - Hapus (Perlu delete)
router.delete(
  "/:nomor",
  [verifyToken, checkPermission(PEMBELIAN_MENU_ID, "delete")],
  pembelianController.deletePembelianData
);

// GET /api/pembelian/form/:nomor - Load data form edit
router.get(
  "/form/:nomor",
  [verifyToken, checkPermission(PEMBELIAN_MENU_ID, "edit")],
  pembelianController.getFormData
);

// POST /api/pembelian/save - Simpan (Baru/Ubah)
router.post(
  "/save",
  [verifyToken, checkSavePermission(PEMBELIAN_MENU_ID)],
  pembelianController.saveData
);

// GET /api/pembelian/lookup/barcode/:barcode - Scan Barcode
router.get(
  "/lookup/barcode/:barcode",
  [verifyToken, checkPermission(PEMBELIAN_MENU_ID, "insert")], // Perlu izin insert
  pembelianController.getBarcodeLookup
);

// GET /api/pembelian/lookup/invoice/:nomor - Tarik Invoice Eksternal
router.get(
  "/lookup/invoice/:nomor",
  [verifyToken, checkPermission(PEMBELIAN_MENU_ID, "insert")], // Perlu izin insert
  pembelianController.getInvoiceLookup
);

module.exports = router;
