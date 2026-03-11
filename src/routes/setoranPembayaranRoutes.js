const express = require("express");
const router = express.Router();
const controller = require("../controllers/setoranPembayaranController");
const {
  verifyToken,
  checkPermission,
  checkSavePermission, // <-- Pastikan ini ditambahkan
} = require("../middlewares/authMiddleware");

const MENU_ID = "33";

router.get(
  "/",
  [verifyToken, checkPermission(MENU_ID, "view")],
  controller.getHeaders,
);
router.get(
  "/:nomor/form-data",
  [verifyToken, checkPermission(MENU_ID, "view")],
  controller.getFormData, // Pastikan fungsi ini ada di controller Anda
);
router.get(
  "/:nomor/print",
  [verifyToken, checkPermission(MENU_ID, "view")],
  controller.printData,
);
router.get(
  "/:nomor/details",
  [verifyToken, checkPermission(MENU_ID, "view")],
  controller.getDetails,
);
router.delete(
  "/:nomor",
  [verifyToken, checkPermission(MENU_ID, "delete")],
  controller.removeData,
);
// Endpoint untuk Bantuan Invoice
router.get("/unpaid/:cusKode", verifyToken, controller.getUnpaidInvoices);

// Endpoint Simpan (Baru/Ubah)
router.post(
  "/save",
  [verifyToken, checkSavePermission(MENU_ID)],
  controller.saveData,
);

module.exports = router;
