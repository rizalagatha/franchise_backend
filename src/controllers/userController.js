const userService = require("../services/userService");

const getUserList = async (req, res) => {
  try {
    const data = await userService.getActiveUsers();
    res.json(data);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal mengambil daftar user.", error: error.message });
  }
};

module.exports = { getUserList };
