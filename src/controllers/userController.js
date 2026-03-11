const userService = require("../services/userService");
const { pool } = require("../config/database");

const getBrowseUsers = async (req, res) => {
  try {
    const data = await userService.getUsers();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { kode } = req.params;
    const result = await userService.deleteUser(kode);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getFormResources = async (req, res) => {
  try {
    const menus = await userService.getMenus();
    let userData = null;

    // Jika ada parameter ID, berarti mode edit, ambil data usernya sekalian
    if (req.params.kode) {
      userData = await userService.getUserById(req.params.kode);
    }

    res.json({ menus, userData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const saveUser = async (req, res) => {
  try {
    const result = await userService.saveUser(req.body.data, req.body.isNew);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    // Mengambil user_kode dari token yang sudah di-verify oleh authMiddleware
    const userKode = req.user.kode;

    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Password lama dan baru wajib diisi." });
    }

    const result = await userService.changePassword(
      userKode,
      oldPassword,
      newPassword,
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getUserList = async (req, res) => {
  try {
    // Ambil user yang aktif untuk dropdown kasir
    const [rows] = await pool.query(
      "SELECT user_kode, user_nama FROM tuser WHERE user_aktif = 'Y' ORDER BY user_nama ASC",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getBrowseUsers,
  deleteUser,
  getFormResources,
  saveUser,
  changePassword,
  getUserList,
};
