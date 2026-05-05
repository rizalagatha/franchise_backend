const express = require("express");
const router = express.Router();
const rekeningController = require("../controllers/rekeningController");
const {
  verifyToken,
  checkPermission,
  checkSavePermission,
} = require("../middlewares/authMiddleware");
const { injectBranchDb } = require("../middlewares/branchMiddleware");

const REKENING_MENU_ID = "14";

// GET /api/rekening (Browse)
router.get(
  "/",
  [verifyToken, injectBranchDb, checkPermission(REKENING_MENU_ID, "view")],
  rekeningController.getHeaders,
);

// DELETE /api/rekening/:nomor (Delete)
router.delete(
  "/:nomor",
  [verifyToken, injectBranchDb, checkPermission(REKENING_MENU_ID, "delete")],
  rekeningController.deleteRekeningData,
);

// GET /api/rekening/form/:nomor (Untuk cek/load data di form)
router.get(
  "/form/:nomor",
  [verifyToken, injectBranchDb, checkPermission(REKENING_MENU_ID, "view")],
  rekeningController.getRekening,
);

// POST /api/rekening/save (Simpan Baru/Ubah)
router.post(
  "/save",
  [verifyToken, injectBranchDb, checkSavePermission(REKENING_MENU_ID)],
  rekeningController.saveData,
);

// GET /api/rekening/lookup (Untuk F1 di dialog)
router.get(
  "/lookup",
  [verifyToken, injectBranchDb, checkPermission(REKENING_MENU_ID, "view")],
  rekeningController.lookup,
);

module.exports = router;
