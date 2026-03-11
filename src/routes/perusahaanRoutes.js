const express = require("express");
const router = express.Router();
const perusahaanController = require("../controllers/perusahaanController");
const { verifyToken } = require("../middlewares/authMiddleware");

// Endpoint: GET /api/perusahaan
router.get("/", [verifyToken], perusahaanController.getPerusahaan);

module.exports = router;
