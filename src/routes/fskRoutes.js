const express = require("express");
const router = express.Router();
const fskController = require("../controllers/fskController");
const {
  verifyToken,
  checkPermission,
  checkSavePermission,
} = require("../middlewares/authMiddleware");

const MENU_ID = "32";

// 1. Browse data
router.get(
  "/",
  [verifyToken, checkPermission(MENU_ID, "view")],
  fskController.getHeaders,
);

// 2. Generate Rekap (Harus di atas :nomor)
router.get(
  "/generate-rekap",
  [verifyToken, checkPermission(MENU_ID, "view")],
  fskController.getRekap,
);

// 3. CETAK FSK (Gunakan path /print/)
router.get(
  "/print/:nomor",
  [verifyToken, checkPermission(MENU_ID, "view")],
  fskController.getPrintData,
);

// 4. Form Data untuk Edit
router.get(
  "/:nomor/form-data",
  [verifyToken, checkPermission(MENU_ID, "view")],
  fskController.getFormData,
);

// 5. Detail Browse
router.get(
  "/:nomor/details",
  [verifyToken, checkPermission(MENU_ID, "view")],
  fskController.getDetails,
);

// 6. Catch-all untuk satu nomor (Opsional jika form-data sudah cukup)
router.get(
  "/:nomor",
  [verifyToken, checkPermission(MENU_ID, "view")],
  fskController.getFormData,
);

// 7. Simpan Data
router.post(
  "/save",
  [verifyToken, checkSavePermission(MENU_ID)],
  fskController.saveNewFSK,
);

// 8. Hapus Data
router.delete(
  "/:nomor",
  [verifyToken, checkPermission(MENU_ID, "delete")],
  fskController.removeFSK,
);

module.exports = router;
