const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { verifyToken } = require("../middlewares/authMiddleware");

// GET /api/users/list
router.get("/list", verifyToken, userController.getUserList);

module.exports = router;
