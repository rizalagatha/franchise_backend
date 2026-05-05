const userService = require("../services/userService");

const getBrowseUsers = async (req, res) => {
  try {
    const data = await userService.getUsers(req.db);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { kode } = req.params;
    const result = await userService.deleteUser(req.db, kode);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getFormResources = async (req, res) => {
  try {
    const menus = await userService.getMenus(req.db);
    let userData = null;

    // Jika ada parameter ID, berarti mode edit, ambil data usernya sekalian
    if (req.params.kode) {
      userData = await userService.getUserById(req.db, req.params.kode);
    }

    res.json({ menus, userData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const saveUser = async (req, res) => {
  try {
    const result = await userService.saveUser(
      req.db,
      req.body.data,
      req.body.isNew,
    );
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
      req.db,
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
    // Dipindahkan ke service agar controller lebih bersih
    const data = await userService.getUserList(req.db);
    res.json(data);
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
