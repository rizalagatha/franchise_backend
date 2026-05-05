const express = require("express");
const router = express.Router();
const mintaBarangController = require("../controllers/mintaBarangController.js");
const {
  verifyToken,
  checkPermission,
} = require("../middlewares/authMiddleware.js");
const { injectBranchDb } = require("../middlewares/branchMiddleware.js");

const MINTA_BARANG_MENU_ID = "25";

// Lookup Barang dari tabel Federated (Pusat)
router.get(
  "/lookup/barang",
  [verifyToken, injectBranchDb, checkPermission(MINTA_BARANG_MENU_ID, "view")],
  mintaBarangController.lookupBarang,
);

// Browse Header
router.get(
  "/",
  [verifyToken, injectBranchDb, checkPermission(MINTA_BARANG_MENU_ID, "view")],
  mintaBarangController.getHeaders,
);

router.get(
  "/print/:nomor",
  [verifyToken, injectBranchDb],
  mintaBarangController.getPrintData,
);

// Browse Detail
router.get(
  "/:nomor/details",
  [verifyToken, injectBranchDb, checkPermission(MINTA_BARANG_MENU_ID, "view")],
  mintaBarangController.getDetails,
);

// Delete Permintaan
router.delete(
  "/:nomor",
  [
    verifyToken,
    injectBranchDb,
    checkPermission(MINTA_BARANG_MENU_ID, "delete"),
  ],
  mintaBarangController.removeRequest,
);

// Load data edit
router.get(
  "/form/:nomor",
  [verifyToken, injectBranchDb, checkPermission(MINTA_BARANG_MENU_ID, "edit")],
  mintaBarangController.getFormData,
);

// Simpan baru/ubah
router.post(
  "/save",
  [verifyToken, injectBranchDb],
  mintaBarangController.saveData,
);

module.exports = router;
