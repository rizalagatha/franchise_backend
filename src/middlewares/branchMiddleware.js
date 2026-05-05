const { getBranchDb } = require("../config/database");

// Middleware untuk menyuntikkan koneksi DB cabang berdasarkan data user di token
const injectBranchDb = async (req, res, next) => {
  try {
    // Pastikan req.user sudah diisi oleh verifyToken sebelumnya
    if (!req.user || !req.user.cabang || !req.user.cabang.db_name) {
      return res
        .status(403)
        .json({ message: "Akses ditolak. Informasi cabang tidak valid." });
    }

    // Ambil koneksi pool untuk cabang tersebut
    const branchPool = await getBranchDb(req.user.cabang);

    // Sisipkan pool ke object request agar bisa dipakai di Controller
    req.db = branchPool;

    next();
  } catch (error) {
    res.status(500).json({
      message: "Gagal menghubungkan ke database cabang.",
      error: error.message,
    });
  }
};

module.exports = {
  injectBranchDb,
};
