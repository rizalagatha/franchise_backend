const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");

// Import dari middleware yang sudah dipisah fungsinya
const {
  verifyToken,
  checkPermission,
  checkSavePermission,
} = require("../middlewares/authMiddleware");
const { injectBranchDb } = require("../middlewares/branchMiddleware");

const CUSTOMER_MENU_ID = "11";

// GET /api/customers
router.get(
  "/",
  [verifyToken, injectBranchDb, checkPermission(CUSTOMER_MENU_ID, "view")],
  customerController.getAllCustomers,
);

// GET /api/customers/:kode - Ambil detail (Perlu izin view)
router.get(
  "/:kode",
  [verifyToken, injectBranchDb, checkPermission(CUSTOMER_MENU_ID, "view")],
  customerController.getCustomer,
);

// POST /api/customers - Buat baru (Perlu izin insert)
router.post(
  "/",
  // Gunakan checkSavePermission (akan cek isNew: true -> insert)
  [verifyToken, injectBranchDb, checkSavePermission(CUSTOMER_MENU_ID)],
  customerController.createNewCustomer,
);

// PUT /api/customers/:kode - Update (Perlu izin edit)
router.put(
  "/:kode",
  // Gunakan checkSavePermission (akan cek isNew: false -> edit)
  [verifyToken, injectBranchDb, checkSavePermission(CUSTOMER_MENU_ID)],
  customerController.updateExistingCustomer,
);

// DELETE /api/customers/:kode - Hapus (Nanti, perlu izin delete)
// router.delete(...)

module.exports = router;
