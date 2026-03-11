const express = require("express");
const router = express.Router();
const controller = require("../controllers/dashboardController");
const { verifyToken } = require("../middlewares/authMiddleware");

router.get("/summary", verifyToken, controller.getData);
router.get("/chart", verifyToken, controller.getChart);

module.exports = router;
