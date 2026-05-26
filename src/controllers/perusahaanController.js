const perusahaanService = require("../services/perusahaanService");
const { pool } = require("../config/database");

const getPerusahaan = async (req, res) => {
  try {
    // Gunakan pool (Master DB) secara eksplisit untuk mengambil list cabang
    const data = await perusahaanService.getPerusahaanList(pool);
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
