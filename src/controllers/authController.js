const authService = require("../services/authService");

const login = async (req, res) => {
  try {
    const { kodeUser, password } = req.body;

    // Panggil service
    const result = await authService.loginUser(kodeUser, password);

    // Kirim payload final (token, user, permissions)
    res.json(result);
  } catch (error) {
    // Jika authService melempar error (misal: "User atau password salah")
    res.status(401).json({ message: error.message });
  }
};

module.exports = {
  login,
  // Kita HAPUS selectBranch
};
