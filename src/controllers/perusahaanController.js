const perusahaanService = require("../services/perusahaanService");

const getPerusahaan = async (req, res) => {
  try {
    const data = await perusahaanService.getPerusahaanList();
    res.json(data);
  } catch (error) {
    console.error("Error getPerusahaan:", error);
    res.status(500).json({ message: "Gagal memuat data perusahaan." });
  }
};

const saveData = async (req, res) => {
  try {
    // 'data' adalah object { rek_nomor, ... }, 'isNew' adalah boolean
    const { data, isNew } = req.body;
    const result = await perusahaanService.savePerusahaan(data, isNew);
    res.status(isNew ? 201 : 200).json(result);
  } catch (error) {
    // Kirim 400 jika error validasi (misal: "No. Rekening kosong")
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getPerusahaan,
  saveData,
};
