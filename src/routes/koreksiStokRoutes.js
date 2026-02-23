const express = require('express');
const router = express.Router();
const koreksiStokController = require('../controllers/koreksiStokController');
const { verifyToken, checkPermission, checkSavePermission } = require('../middlewares/authMiddleware');

const KOREKSI_MENU_ID = '23'; 

// GET /api/koreksi-stok (Browse)
router.get('/', [verifyToken, checkPermission(KOREKSI_MENU_ID, 'view')], koreksiStokController.getHeaders);

// GET /api/koreksi-stok/:nomor/details (Browse Detail)
router.get('/:nomor/details', [verifyToken, checkPermission(KOREKSI_MENU_ID, 'view')], koreksiStokController.getDetails);

// DELETE /api/koreksi-stok/:nomor (Delete)
router.delete('/:nomor', [verifyToken, checkPermission(KOREKSI_MENU_ID, 'delete')], koreksiStokController.deleteKoreksiData);

// GET /api/koreksi-stok/form/:nomor (Load Edit Form)
router.get('/form/:nomor', [verifyToken, checkPermission(KOREKSI_MENU_ID, 'edit')], koreksiStokController.getFormData);

// POST /api/koreksi-stok/save (Simpan Baru/Ubah)
router.post('/save', [verifyToken, checkSavePermission(KOREKSI_MENU_ID)], koreksiStokController.saveData);

// GET /api/koreksi-stok/lookup/barcode (Scan)
router.get('/lookup/barcode', [verifyToken, checkPermission(KOREKSI_MENU_ID, 'insert')], koreksiStokController.getBarcodeLookup);

// GET /api/koreksi-stok/lookup/f1 (F1 Modal)
router.get('/lookup/f1', [verifyToken, checkPermission(KOREKSI_MENU_ID, 'insert')], koreksiStokController.getF1Lookup);

// GET /api/koreksi-stok/print/:nomor (Cetak)
router.get('/print/:nomor', [verifyToken, checkPermission(KOREKSI_MENU_ID, 'view')], koreksiStokController.getPrintData);

module.exports = router;