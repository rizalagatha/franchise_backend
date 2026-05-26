const perusahaanService = require("../services/perusahaanService");
const { pool } = require("../config/database");

const getPerusahaan = async (req, res) => {
  try {
    // Cek apakah req.db tersedia dari middleware multi-tenant.
    // Jika undefined, gunakan pool standar dari config.
    const dbConnection = req.db || pool;

    const data = await perusahaanService.getPerusahaanList(dbConnection);
    res.json(data);
  } catch (error) {
    console.error("Error getPerusahaan:", error);
    // Tambahkan error.message agar alasan crash bisa terbaca di frontend
    res.status(500).json({
      message: "Gagal memuat data perusahaan.",
      error: error.message,
    });
  }
};

const saveData = async (req, res) => {
  try {
    const { data, isNew } = req.body;
    const dbConnection = req.db || pool; // Gunakan fallback juga

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
