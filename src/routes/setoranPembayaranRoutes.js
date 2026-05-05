const express = require("express");
const router = express.Router();
const controller = require("../controllers/setoranPembayaranController");
const {
  verifyToken,
  checkPermission,
  checkSavePermission,
} = require("../middlewares/authMiddleware");
const { injectBranchDb } = require("../middlewares/branchMiddleware");

const MENU_ID = "33";

router.get(
  "/",
  [verifyToken, injectBranchDb, checkPermission(MENU_ID, "view")],
  controller.getHeaders,
);
router.get(
  "/:nomor/form-data",
  [verifyToken, injectBranchDb, checkPermission(MENU_ID, "view")],
  controller.getFormData,
);
router.get(
  "/:nomor/print",
  [verifyToken, injectBranchDb, checkPermission(MENU_ID, "view")],
  controller.printData,
);
router.get(
  "/:nomor/details",
  [verifyToken, injectBranchDb, checkPermission(MENU_ID, "view")],
  controller.getDetails,
);
router.delete(
  "/:nomor",
  [verifyToken, injectBranchDb, checkPermission(MENU_ID, "delete")],
  controller.removeData,
);
// Endpoint untuk Bantuan Invoice
router.get(
  "/unpaid/:cusKode",
  [verifyToken, injectBranchDb],
  controller.getUnpaidInvoices,
);

// Endpoint Simpan (Baru/Ubah)
router.post(
  "/save",
  [verifyToken, injectBranchDb, checkSavePermission(MENU_ID)],
  controller.saveData,
);

module.exports = router;
