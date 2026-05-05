const express = require("express");
const router = express.Router();
const kasirController = require("../controllers/kasirController");
const {
  verifyToken,
  checkPermission,
} = require("../middlewares/authMiddleware");
const { injectBranchDb } = require("../middlewares/branchMiddleware");

const KASIR_MENU_ID = "31";

// Browse Header
router.get(
  "/",
  [verifyToken, injectBranchDb, checkPermission(KASIR_MENU_ID, "view")],
  kasirController.getHeaders,
);

// Browse Detail
router.get(
  "/:nomor/details",
  [verifyToken, injectBranchDb, checkPermission(KASIR_MENU_ID, "view")],
  kasirController.getDetails,
);

router.get(
  "/print/:nomor",
  [verifyToken, injectBranchDb, checkPermission(KASIR_MENU_ID, "view")],
  kasirController.getPrintData,
);

router.get(
  "/print-a4/:nomor",
  [verifyToken, injectBranchDb, checkPermission(KASIR_MENU_ID, "view")],
  kasirController.getPrintDataA4,
);

// Delete Invoice
router.delete(
  "/:nomor",
  [verifyToken, injectBranchDb, checkPermission(KASIR_MENU_ID, "delete")],
  kasirController.removeInvoice,
);

// GET /api/kasir/form/:nomor (Load data edit)
router.get(
  "/form/:nomor",
  [verifyToken, injectBranchDb, checkPermission(KASIR_MENU_ID, "edit")],
  kasirController.getFormData,
);

// POST /api/kasir/save (Simpan baru/ubah)
router.post("/save", [verifyToken, injectBranchDb], kasirController.saveData);

module.exports = router;
