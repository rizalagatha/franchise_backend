// src/controllers/userController.js
const userService = require("../services/userService");

const getBrowseUsers = async (req, res) => {
  try {
    // Ambil ID Cabang dari JWT Token
    const cabangId = req.user.cabang.id;
    const data = await userService.getUsers(cabangId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { kode } = req.params;
    const cabangId = req.user.cabang.id;
    const result = await userService.deleteUser(cabangId, kode);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getFormResources = async (req, res) => {
  try {
    const cabangId = req.user.cabang.id;
    const menus = await userService.getMenus(); // Menu bersifat global di Master
    let userData = null;

    if (req.params.kode) {
      userData = await userService.getUserById(cabangId, req.params.kode);
    }

    res.json({ menus, userData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const saveUser = async (req, res) => {
  try {
    const cabangId = req.user.cabang.id;
    const result = await userService.saveUser(
      cabangId,
      req.body.data,
      req.body.isNew,
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getUserList = async (req, res) => {
  try {
    const cabangId = req.user.cabang.id;
    const data = await userService.getUserList(cabangId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userKode = req.user.kode;
    const cabangId = req.user.cabang.id; // Ambil dari JWT

    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Password lama dan baru wajib diisi." });
    }

    const result = await userService.changePassword(
      cabangId,
      userKode,
      oldPassword,
      newPassword,
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const acceptTerms = async (req, res) => {
  try {
    const username = req.user.kode; // Ambil dari token JWT
    const result = await userService.acceptTerms(username);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getBrowseUsers,
  deleteUser,
  getFormResources,
  saveUser,
  getUserList,
  changePassword,
  acceptTerms,
};
