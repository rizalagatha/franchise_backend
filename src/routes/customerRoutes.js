const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");
// Tambahkan checkSavePermission
const {
  verifyToken,
  checkPermission,
  checkSavePermission,
} = require("../middlewares/authMiddleware");

const CUSTOMER_MENU_ID = "11";

// GET /api/customers (Sudah ada)
router.get(
  "/",
  [verifyToken, checkPermission(CUSTOMER_MENU_ID, "view")],
  customerController.getAllCustomers,
);

// GET /api/customers/:kode - Ambil detail (Perlu izin view)
router.get(
  "/:kode",
  [verifyToken, checkPermission(CUSTOMER_MENU_ID, "view")],
  customerController.getCustomer,
);

// POST /api/customers - Buat baru (Perlu izin insert)
router.post(
  "/",
  // Gunakan checkSavePermission (akan cek isNew: true -> insert)
  [verifyToken, checkSavePermission(CUSTOMER_MENU_ID)],
  customerController.createNewCustomer,
);

// PUT /api/customers/:kode - Update (Perlu izin edit)
router.put(
  "/:kode",
  // Gunakan checkSavePermission (akan cek isNew: false -> edit)
  [verifyToken, checkSavePermission(CUSTOMER_MENU_ID)],
  customerController.updateExistingCustomer,
);

// DELETE /api/customers/:kode - Hapus (Nanti, perlu izin delete)
// router.delete(...)

module.exports = router;
