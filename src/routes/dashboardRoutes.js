const express = require("express");
const router = express.Router();
const controller = require("../controllers/dashboardController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { injectBranchDb } = require("../middlewares/branchMiddleware");

// Tambahkan injectBranchDb setelah verifyToken
router.get("/summary", [verifyToken, injectBranchDb], controller.getData);
router.get("/chart", [verifyToken, injectBranchDb], controller.getChart);

module.exports = router;
