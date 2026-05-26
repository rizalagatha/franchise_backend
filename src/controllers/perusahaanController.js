const perusahaanService = require("../services/perusahaanService");
const { pool } = require("../config/database");

const getPerusahaan = async (req, res) => {
  try {
    // Ambil ID cabang dan role dari token JWT user yang sedang login
    // Berdasarkan authService kamu, strukturnya ada di req.user.cabang.id
    const userCabangId = req.user.cabang.id || req.user.cabang;
    const userRole = req.user.role;

    const data = await perusahaanService.getPerusahaanList(
      pool,
      userCabangId,
      userRole,
    );
    res.json(data);
  } catch (error) {
    console.error("Error getPerusahaan:", error);
    res.status(500).json({
      message: "Gagal memuat data perusahaan.",
      error: error.message,
    });
  }
};

const saveData = async (req, res) => {
  try {
    const { data, isNew } = req.body;
    // Untuk save data perusahaan, tetap gunakan koneksi dinamis (cabang)
    const dbConnection = req.db || pool;

    const result = await perusahaanService.savePerusahaan(
      dbConnection,
      data,
      isNew,
    );
    res.status(isNew ? 201 : 200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getPerusahaan,
  saveData,
};
